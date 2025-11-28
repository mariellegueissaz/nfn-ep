import React, {useEffect, useMemo, useState} from 'react';
import {Routes, Route, useLocation} from 'react-router-dom';
import {initializeApp} from 'firebase/app';
import {getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'firebase/auth';
import EventsList from './components/EventsList.jsx';
import Header from './components/Header.jsx';
import EventDetails from './components/EventDetails.jsx';
import {useAirtableData} from './hooks/useAirtableData.js';
import {usePromoterProfile} from './hooks/usePromoterProfile.js';
import ProfileModal from './components/ProfileModal.jsx';

function Input({id, type = 'text', value, onChange, placeholder}) {
    return (
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100 focus:outline-none focus:ring-2 focus:ring-blue-blue"
            placeholder={placeholder}
        />
    );
}

export default function App() {
    const [auth, setAuth] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [step, setStep] = useState('email');
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [showSuccessNotification, setShowSuccessNotification] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [saveProfileError, setSaveProfileError] = useState('');
    const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);

    // Field mappings formerly defined via custom properties
    const fieldMappings = useMemo(() => ({
        promoterEmailField: import.meta.env.VITE_FIELD_PROMOTER_EMAIL || 'Signee Party Email (from Contract party 2)',
        startDateField: import.meta.env.VITE_FIELD_START || 'Doors open',
        endDateField: import.meta.env.VITE_FIELD_END || 'End',
        eventNameField: import.meta.env.VITE_FIELD_EVENT_NAME || 'Eventname',
        locationField: import.meta.env.VITE_FIELD_LOCATION || 'Location',
        proposedAnnouncementDateField: import.meta.env.VITE_FIELD_PROPOSED_ANNOUNCEMENT || 'Proposed Announcement Date',
        publicTicketReleaseDateField: import.meta.env.VITE_FIELD_PUBLIC_TICKET_RELEASE || 'Proposed Ticket on Sale Date',
        proposedLineupField: import.meta.env.VITE_FIELD_PROPOSED_LINEUP || 'Proposed line-up (and timetable)'
    }), []);

    // Table name
    const tableName = useMemo(() => import.meta.env.VITE_TABLE_NAME || 'Events', []);

    // Initialize Firebase
    useEffect(() => {
        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        };
        const app = initializeApp(firebaseConfig);
        const firebaseAuth = getAuth(app);
        setAuth(firebaseAuth);
    }, []);

    // Auth state changes
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setIsCheckingAuth(false);
            if (user) {
                setStep('success');
                setShowSuccessNotification(true);
                setTimeout(() => setShowSuccessNotification(false), 3000);
            }
        });
        return () => unsubscribe();
    }, [auth]);

    const promoterMappings = useMemo(() => ({
        // CRM path configuration
        crmEmailField: import.meta.env.VITE_CRM_EMAIL_FIELD || 'E-mail',
        crmPromotersLinkField: import.meta.env.VITE_CRM_PROMOTERS_LINK_FIELD || 'Promoters',
        // SOURCE promoter field names (used for display and saving)
        companyNameField: import.meta.env.VITE_SOURCE_PROMOTER_COMPANY_NAME || 'Promoter',
        addressField: import.meta.env.VITE_SOURCE_PROMOTER_ADDRESS || 'Address',
        zipcodeField: import.meta.env.VITE_SOURCE_PROMOTER_ZIPCODE || 'Zipcode',
        cityField: import.meta.env.VITE_SOURCE_PROMOTER_CITY || 'City',
        cocField: import.meta.env.VITE_SOURCE_PROMOTER_COC || 'COC',
        vatIdField: import.meta.env.VITE_SOURCE_PROMOTER_VAT_ID || 'VAT ID',
        ibanField: import.meta.env.VITE_SOURCE_PROMOTER_IBAN || 'IBAN number for ticket income',
        websiteField: import.meta.env.VITE_SOURCE_PROMOTER_WEBSITE || 'Website',
        // SOURCE contacts linkage and fields
        sourceContactsLinkField: import.meta.env.VITE_SOURCE_CONTACTS_LINK_FIELD || 'Contactpersons',
        sourceCrmTable: import.meta.env.VITE_SOURCE_CRM_TABLE_ID || import.meta.env.VITE_SOURCE_CRM_TABLE_NAME || 'CRM',
        contactFirstNameField: import.meta.env.VITE_SOURCE_CONTACT_FIRST_NAME || 'First name',
        contactLastNameField: import.meta.env.VITE_SOURCE_CONTACT_LAST_NAME || 'Last name',
        contactEmailField: import.meta.env.VITE_SOURCE_CONTACT_EMAIL || 'E-mail',
        contactMobileField: import.meta.env.VITE_SOURCE_CONTACT_MOBILE || 'Mobile',
        contactAuthorizedField: import.meta.env.VITE_SOURCE_CONTACT_AUTHORIZED || 'Authorized to sign'
    }), [fieldMappings]);

    const {promoterRecord, promoterRecordId, contacts, loading: promoterLoading, error: promoterError, save: savePromoter, saveContact, createContact, unlinkContact, reload: reloadPromoter} = usePromoterProfile(
        currentUser?.email,
        promoterMappings
    );

    const {records, loading: dataLoading, error: dataError} = useAirtableData(
        tableName,
        promoterRecord,
        promoterRecordId,
        fieldMappings
    );

    const handleSaveProfile = async (values) => {
        try {
            setIsSavingProfile(true);
            setSaveProfileError('');
            // Only send known fields; convert empty strings to null to clear fields
            const fields = {};
            const keys = [
                promoterMappings.companyNameField,
                promoterMappings.addressField,
                promoterMappings.zipcodeField,
                promoterMappings.cityField,
                promoterMappings.cocField,
                promoterMappings.vatIdField,
                promoterMappings.ibanField,
                promoterMappings.websiteField
            ];
            for (const k of keys) {
                if (k in values) {
                    let v = values[k];
                    if (v === '' || v === undefined) {
                        fields[k] = null;
                    } else if (k === promoterMappings.cocField) {
                        const num = typeof v === 'number' ? v : Number(v);
                        if (Number.isNaN(num)) {
                            setSaveProfileError('COC must be a number');
                            setIsSavingProfile(false);
                            return;
                        }
                        fields[k] = num;
                    } else {
                        fields[k] = v;
                    }
                }
            }

            // Use SOURCE mappings only for save
            await savePromoter(fields, fields);
            await reloadPromoter();
            setSaveProfileSuccess(true);
            setTimeout(() => setSaveProfileSuccess(false), 2000);
        } catch (e) {
            console.error(e);
            setSaveProfileError(e?.message || 'Failed to save');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        setError('');
        setStep('choice');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!auth) { setError('Authentication not configured'); return; }
        try {
            setStep('loading');
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setStep('login');
            if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') setError('Invalid email or password');
            else if (err.code === 'auth/too-many-requests') setError('Too many failed attempts. Please try again later.');
            else setError(err.message || 'Login failed');
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        if (!auth) { setError('Authentication not configured'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        try {
            setStep('loading');
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setStep('signup');
            if (err.code === 'auth/email-already-in-use') setError('Email already in use. Try logging in instead.');
            else if (err.code === 'auth/weak-password') setError('Password is too weak. Please use a stronger password.');
            else if (err.code === 'auth/invalid-email') setError('Invalid email address');
            else setError(err.message || 'Signup failed');
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setStep('email');
            setEmail('');
            setPassword('');
            setConfirmPassword('');
            setError('');
            setCurrentUser(null);
        } catch (err) {
            setError(err.message || 'Logout failed');
        }
    };

    const handleNavigateHome = () => {
        setIsProfileOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackToEmail = () => { setStep('email'); setPassword(''); setConfirmPassword(''); setError(''); };
    const handleBackToChoice = () => { setStep('choice'); setPassword(''); setConfirmPassword(''); setError(''); };

    if (isCheckingAuth || step === 'loading') {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-gray600 dark:text-gray-gray300">Loading...</p>
                </div>
            </div>
        );
    }

    if (step === 'success' && currentUser) {
        return (
            <div className="min-h-screen w-full bg-gray-gray50 dark:bg-gray-gray800">
                {showSuccessNotification && (
                    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
                        <div className="bg-green-green text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
                            <span className="text-xl">✅</span>
                            <span className="font-medium">Logged in successfully</span>
                        </div>
                    </div>
                )}
                <Header
                    onOpenProfile={() => setIsProfileOpen(true)}
                    onLogout={handleLogout}
                    onNavigateHome={handleNavigateHome}
                />
                <Routes>
                    <Route
                        path="/"
                        element={
                            <div className="p-4 sm:p-6">
                                <EventsList
                                    records={records}
                                    loading={dataLoading}
                                    error={dataError}
                                    fieldMappings={fieldMappings}
                                    currentUserEmail={currentUser.email}
                                />
                            </div>
                        }
                    />
                    <Route
                        path="/events/:eventId"
                        element={<EventDetails fieldMappings={fieldMappings} />}
                    />
                </Routes>
                <ProfileModal
                    open={isProfileOpen}
                    onClose={() => setIsProfileOpen(false)}
                    promoter={promoterRecord}
                    contacts={contacts}
                    mappings={promoterMappings}
                    onSave={handleSaveProfile}
                    onSaveContact={saveContact}
                    onCreateContact={createContact}
                    onUnlinkContact={unlinkContact}
                    loading={promoterLoading}
                    saving={isSavingProfile}
                    error={promoterError}
                    saveError={saveProfileError}
                    saveSuccess={saveProfileSuccess}
                />
            </div>
        );
    }

    if (step === 'choice') {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="max-w-md w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <button type="button" onClick={handleBackToEmail} className="mb-4 text-blue-blue hover:underline text-sm">← Back</button>
                    <h1 className="text-2xl font-bold text-gray-gray800 dark:text-gray-gray100 mb-2 text-center">{email}</h1>
                    <p className="text-sm text-gray-gray600 dark:text-gray-gray300 mb-6 text-center">Do you have an account?</p>
                    <div className="space-y-3">
                        <button type="button" onClick={() => setStep('login')} className="w-full px-4 py-3 bg-blue-blue text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2 transition-colors font-medium">Yes, log me in</button>
                        <button type="button" onClick={() => setStep('signup')} className="w-full px-4 py-3 bg-white dark:bg-gray-gray800 border-2 border-blue-blue text-blue-blue rounded-md hover:bg-blue-blue hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2 transition-colors font-medium">No, create an account</button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'login') {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="max-w-md w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <button type="button" onClick={handleBackToChoice} className="mb-4 text-blue-blue hover:underline text-sm">← Back</button>
                    <h1 className="text-2xl font-bold text-gray-gray800 dark:text-gray-gray100 mb-2 text-center">Welcome Back</h1>
                    <p className="text-sm text-gray-gray600 dark:text-gray-gray300 mb-6 text-center">{email}</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-gray700 dark:text-gray-gray200 mb-1">Password</label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
                        </div>
                        {error && <div className="p-3 bg-red-red bg-opacity-10 border border-red-red rounded-md"><p className="text-sm text-red-red">{error}</p></div>}
                        <button type="submit" className="w-full px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2 transition-colors font-medium">Login</button>
                    </form>
                </div>
            </div>
        );
    }

    if (step === 'signup') {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
                <div className="max-w-md w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                    <button type="button" onClick={handleBackToChoice} className="mb-4 text-blue-blue hover:underline text-sm">← Back</button>
                    <h1 className="text-2xl font-bold text-gray-gray800 dark:text-gray-gray100 mb-2 text-center">Create Account</h1>
                    <p className="text-sm text-gray-gray600 dark:text-gray-gray300 mb-6 text-center">{email}</p>
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-gray700 dark:text-gray-gray200 mb-1">Password</label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (min 6 characters)" />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-gray700 dark:text-gray-gray200 mb-1">Confirm Password</label>
                            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" />
                        </div>
                        {error && <div className="p-3 bg-red-red bg-opacity-10 border border-red-red rounded-md"><p className="text-sm text-red-red">{error}</p></div>}
                        <button type="submit" className="w-full px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2 transition-colors font-medium">Sign Up</button>
                    </form>
                </div>
            </div>
        );
    }

    // Email step
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-gray50 dark:bg-gray-gray800">
            <div className="max-w-md w-full bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-8">
                <h1 className="text-2xl font-bold text-gray-gray800 dark:text-gray-gray100 mb-6 text-center">Get Started</h1>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-gray700 dark:text-gray-gray200 mb-1">Email</label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
                    </div>
                    <button type="submit" className="w-full px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-blue focus:ring-offset-2 transition-colors font-medium">Continue</button>
                </form>
            </div>
        </div>
    );
}


