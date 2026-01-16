import React, {useEffect, useState, useMemo} from 'react';

function FieldRow({label, value, onChange, editable, type = 'text'}) {
    return (
        <div>
            <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">{label}</label>
            {editable ? (
                <input
                    type={type}
                    className="w-full px-3 py-2 border border-gray-gray300 dark:border-gray-gray600 rounded-md bg-white dark:bg-gray-gray800 text-gray-gray800 dark:text-gray-gray100 focus:outline-none focus:ring-2 focus:ring-blue-blue"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <div className="px-3 py-2 bg-gray-gray50 dark:bg-gray-gray800 rounded-md text-gray-gray800 dark:text-gray-gray100 border border-gray-gray200 dark:border-gray-gray600">
                    {value || '—'}
                </div>
            )}
        </div>
    );
}

export default function ProfileModal({open, onClose, promoter, contacts = [], mappings, onSave, onSaveContact, onCreateContact, onUnlinkContact, loading, saving, error, saveError, saveSuccess}) {
    const [editable, setEditable] = useState(false);
    const [values, setValues] = useState({});
    const [addingContact, setAddingContact] = useState(false);

    useEffect(() => {
        if (!mappings) return;
        setEditable(false);
        const f = promoter?.fields || {};
        setValues({
            [mappings.companyNameField || 'Company Name']: f[mappings.companyNameField] || '',
            [mappings.addressField || 'Address']: f[mappings.addressField] || '',
            [mappings.zipcodeField || 'Zipcode']: f[mappings.zipcodeField] || '',
            [mappings.cityField || 'City']: f[mappings.cityField] || '',
            [mappings.cocField || 'COC']: f[mappings.cocField] || '',
            [mappings.vatIdField || 'VAT ID']: f[mappings.vatIdField] || '',
            [mappings.ibanField || 'IBAN']: f[mappings.ibanField] || '',
            [mappings.websiteField || 'Website']: f[mappings.websiteField] || ''
        });
    }, [promoter, mappings]);

    // Check if at least one contact is authorized to sign
    // This hook must be called before any early returns
    const hasAuthorizedContact = useMemo(() => {
        if (!contacts || contacts.length === 0) return false;
        if (!mappings?.contactAuthorizedField) return false;
        return contacts.some(contact => {
            const authorized = contact?.fields?.[mappings.contactAuthorizedField];
            // Handle various formats: boolean true, string "true", number 1, or any truthy value
            // Exclude explicitly false values (false, "false", 0, "", null, undefined)
            if (authorized === false || authorized === 'false' || authorized === 0 || authorized === '' || authorized === null || authorized === undefined) {
                return false;
            }
            // Any other value is considered authorized (true, "true", 1, etc.)
            return !!authorized;
        });
    }, [contacts, mappings?.contactAuthorizedField]);

    if (!open) return null;

    if (!mappings) {
        console.error('ProfileModal: mappings is undefined');
        return null;
    }

    const setField = (key, val) => setValues(prev => ({...prev, [key]: val}));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Your Company</h2>
                    <button onClick={onClose} className="text-gray-gray500 hover:text-gray-gray700 dark:text-gray-gray300 dark:hover:text-gray-gray100">✕</button>
                </div>
                {loading ? (
                    <div className="mb-4 p-4 flex items-center justify-center gap-3">
                        <svg className="animate-spin h-5 w-5 text-blue-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-gray-gray600 dark:text-gray-gray300">Loading profile...</span>
                    </div>
                ) : null}
                {error ? (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">{error}</div>
                ) : null}
                {saveError ? (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">{String(saveError)}</div>
                ) : null}
                {saveSuccess ? (
                    <div className="mb-4 p-3 bg-green-green bg-opacity-10 border border-green-green rounded text-green-green text-sm">Profile Saved</div>
                ) : null}
                {!loading && mappings && (
                    <>
                        <div className="border border-gray-gray200 dark:border-gray-gray600 rounded-md p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="font-medium text-gray-gray800 dark:text-gray-gray100">Company Details</div>
                                <div className="flex items-center gap-2">
                                    {!editable ? (
                                        <button type="button" onClick={() => setEditable(true)} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Edit</button>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => setEditable(false)} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Cancel</button>
                                            <button type="button" disabled={saving} onClick={() => onSave(values)} className="px-3 py-1.5 bg-blue-blue text-white rounded hover:bg-opacity-90 text-sm disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldRow label="Company Name" value={values[mappings?.companyNameField] || ''} editable={editable} onChange={(v) => setField(mappings?.companyNameField, v)} />
                                <FieldRow label="Address" value={values[mappings?.addressField] || ''} editable={editable} onChange={(v) => setField(mappings?.addressField, v)} />
                                <FieldRow label="Zipcode" value={values[mappings?.zipcodeField] || ''} editable={editable} onChange={(v) => setField(mappings?.zipcodeField, v)} />
                                <FieldRow label="City" value={values[mappings?.cityField] || ''} editable={editable} onChange={(v) => setField(mappings?.cityField, v)} />
                                <FieldRow label="COC" value={values[mappings?.cocField] || ''} editable={editable} onChange={(v) => setField(mappings?.cocField, v)} type="number" />
                                <FieldRow label="VAT ID" value={values[mappings?.vatIdField] || ''} editable={editable} onChange={(v) => setField(mappings?.vatIdField, v)} />
                                <FieldRow label="IBAN" value={values[mappings?.ibanField] || ''} editable={editable} onChange={(v) => setField(mappings?.ibanField, v)} />
                                <FieldRow label="Website" value={values[mappings?.websiteField] || ''} editable={editable} onChange={(v) => setField(mappings?.websiteField, v)} type="url" />
                            </div>
                        </div>
                    </>
                )}

                {/* Contacts */}
                {!loading && mappings && (
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100">Contact Persons</h3>
                        {!addingContact && (
                            <button 
                                type="button" 
                                onClick={() => setAddingContact(true)}
                                className="px-3 py-1.5 bg-blue-blue text-white rounded hover:bg-opacity-90 text-sm"
                            >
                                + Add Contact
                            </button>
                        )}
                    </div>
                    {!hasAuthorizedContact && contacts.length > 0 && (
                        <div className="mb-3 p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded text-yellow-800 dark:text-yellow-300 text-sm">
                            At least one contact should be Authorized to sign
                        </div>
                    )}
                    <ul className="space-y-4">
                        {addingContact && (
                            <NewContactCard 
                                mappings={mappings} 
                                onCreateContact={async (fields) => {
                                    await onCreateContact(fields);
                                    setAddingContact(false);
                                }}
                                onCancel={() => setAddingContact(false)}
                            />
                        )}
                        {contacts.map((c) => (
                            <ContactCard 
                                key={c.id} 
                                contact={c} 
                                mappings={mappings} 
                                onSaveContact={onSaveContact}
                                onUnlinkContact={onUnlinkContact}
                            />
                        ))}
                    </ul>
                </div>
                )}
            </div>
        </div>
    );
}

function ContactCard({contact, mappings, onSaveContact, onUnlinkContact}) {
    if (!mappings) return null;
    const [editing, setEditing] = React.useState(false);
    const [local, setLocal] = React.useState({});
    const [deleting, setDeleting] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [saveSuccess, setSaveSuccess] = React.useState(false);
    
    React.useEffect(() => {
        if (!mappings) return;
        const f = contact?.fields || {};
        setLocal({
            [mappings.contactFirstNameField]: f[mappings.contactFirstNameField] || '',
            [mappings.contactLastNameField]: f[mappings.contactLastNameField] || '',
            [mappings.contactEmailField]: f[mappings.contactEmailField] || '',
            [mappings.contactMobileField]: f[mappings.contactMobileField] || '',
            [mappings.contactAuthorizedField]: !!f[mappings.contactAuthorizedField],
        });
    }, [contact, mappings]);

    const setField = (k, v) => setLocal(prev => ({...prev, [k]: v}));

    const onSave = async () => {
        setSaving(true);
        setSaveSuccess(false);
        
        const payload = {};
        for (const k of Object.keys(local)) {
            payload[k] = k === mappings.contactAuthorizedField ? !!local[k] : (local[k] === '' ? null : local[k]);
        }
        
        try {
            await onSaveContact(contact.id, payload);
            setEditing(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            // If save fails, keep editing mode
            console.error('Failed to save contact:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to unlink this contact person?')) {
            setDeleting(true);
            try {
                await onUnlinkContact(contact.id);
            } finally {
                setDeleting(false);
            }
        }
    };

    return (
        <li className="border border-gray-gray200 dark:border-gray-gray600 rounded-md p-4">
            {saving && (
                <div className="mb-3 p-2 bg-blue-blue bg-opacity-10 border border-blue-blue rounded text-blue-blue text-sm flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                </div>
            )}
            {deleting && (
                <div className="mb-3 p-2 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Unlinking contact...
                </div>
            )}
            {saveSuccess && !saving && !deleting && (
                <div className="mb-3 p-2 bg-green-green bg-opacity-10 border border-green-green rounded text-green-green text-sm">
                    Contact person updated successfully
                </div>
            )}
            <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-gray800 dark:text-gray-gray100">
                    {((contact.fields?.[mappings.contactFirstNameField] || '') + ' ' + (contact.fields?.[mappings.contactLastNameField] || '')).trim() || 'Unnamed Contact'}
                </div>
                <div className="flex items-center gap-2">
                    {!editing && !saving && !deleting ? (
                        <>
                            <button type="button" onClick={() => { setEditing(true); setSaveSuccess(false); }} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Edit</button>
                            <button type="button" onClick={handleDelete} className="px-3 py-1.5 bg-red-red text-white rounded hover:bg-opacity-90 text-sm">Delete</button>
                        </>
                    ) : editing && !saving && !deleting ? (
                        <>
                            <button type="button" onClick={() => { setEditing(false); setSaveSuccess(false); }} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Cancel</button>
                            <button type="button" onClick={onSave} disabled={saving} className="px-3 py-1.5 bg-blue-blue text-white rounded hover:bg-opacity-90 text-sm disabled:opacity-60">Save</button>
                        </>
                    ) : null}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="First name" value={local[mappings.contactFirstNameField]} editable={editing && !saving && !deleting} onChange={(v) => setField(mappings.contactFirstNameField, v)} />
                <FieldRow label="Last name" value={local[mappings.contactLastNameField]} editable={editing && !saving && !deleting} onChange={(v) => setField(mappings.contactLastNameField, v)} />
                <FieldRow label="Email" value={local[mappings.contactEmailField]} editable={editing && !saving && !deleting} onChange={(v) => setField(mappings.contactEmailField, v)} type="email" />
                <FieldRow label="Mobile" value={local[mappings.contactMobileField]} editable={editing && !saving && !deleting} onChange={(v) => setField(mappings.contactMobileField, v)} />
                <div>
                    <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Authorized to sign</label>
                    <div className="px-3 py-2">
                        <input 
                            type="checkbox" 
                            checked={!!local[mappings.contactAuthorizedField]} 
                            onChange={(e) => setField(mappings.contactAuthorizedField, e.target.checked)} 
                            disabled={!editing || saving || deleting}
                            className={(!editing || saving || deleting) ? 'opacity-50 cursor-not-allowed' : ''}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}

function NewContactCard({mappings, onCreateContact, onCancel}) {
    if (!mappings) return null;
    const [local, setLocal] = React.useState({
        [mappings.contactFirstNameField]: '',
        [mappings.contactLastNameField]: '',
        [mappings.contactEmailField]: '',
        [mappings.contactMobileField]: '',
        [mappings.contactAuthorizedField]: false,
    });
    const [saving, setSaving] = React.useState(false);

    const setField = (k, v) => setLocal(prev => ({...prev, [k]: v}));

    const onSave = async () => {
        setSaving(true);
        try {
            const payload = {};
            for (const k of Object.keys(local)) {
                payload[k] = k === mappings.contactAuthorizedField ? !!local[k] : (local[k] === '' ? null : local[k]);
            }
            await onCreateContact(payload);
        } finally {
            setSaving(false);
        }
    };

    return (
        <li className="border-2 border-blue-blue border-dashed dark:border-blue-blue rounded-md p-4 bg-blue-blue bg-opacity-5">
            {saving && (
                <div className="mb-3 p-2 bg-blue-blue bg-opacity-10 border border-blue-blue rounded text-blue-blue text-sm flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating contact...
                </div>
            )}
            <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-gray800 dark:text-gray-gray100">New Contact Person</div>
                <div className="flex items-center gap-2">
                    {!saving ? (
                        <>
                            <button type="button" onClick={onCancel} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Cancel</button>
                            <button type="button" onClick={onSave} className="px-3 py-1.5 bg-blue-blue text-white rounded hover:bg-opacity-90 text-sm">Save</button>
                        </>
                    ) : null}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="First name" value={local[mappings.contactFirstNameField]} editable={!saving} onChange={(v) => setField(mappings.contactFirstNameField, v)} />
                <FieldRow label="Last name" value={local[mappings.contactLastNameField]} editable={!saving} onChange={(v) => setField(mappings.contactLastNameField, v)} />
                <FieldRow label="Email" value={local[mappings.contactEmailField]} editable={!saving} onChange={(v) => setField(mappings.contactEmailField, v)} type="email" />
                <FieldRow label="Mobile" value={local[mappings.contactMobileField]} editable={!saving} onChange={(v) => setField(mappings.contactMobileField, v)} />
                <div>
                    <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Authorized to sign</label>
                    <div className="px-3 py-2">
                        <input 
                            type="checkbox" 
                            checked={!!local[mappings.contactAuthorizedField]} 
                            onChange={(e) => setField(mappings.contactAuthorizedField, e.target.checked)} 
                            disabled={saving}
                            className={saving ? 'opacity-50 cursor-not-allowed' : ''}
                        />
                    </div>
                </div>
            </div>
        </li>
    );
}


