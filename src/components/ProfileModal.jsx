import React, {useEffect, useState} from 'react';

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

export default function ProfileModal({open, onClose, promoter, contacts = [], mappings, onSave, onSaveContact, saving, error, saveError, saveSuccess}) {
    const [editable, setEditable] = useState(false);
    const [values, setValues] = useState({});

    useEffect(() => {
        setEditable(false);
        const f = promoter?.fields || {};
        setValues({
            [mappings.companyNameField]: f[mappings.companyNameField] || '',
            [mappings.addressField]: f[mappings.addressField] || '',
            [mappings.zipcodeField]: f[mappings.zipcodeField] || '',
            [mappings.cityField]: f[mappings.cityField] || '',
            [mappings.cocField]: f[mappings.cocField] || '',
            [mappings.vatIdField]: f[mappings.vatIdField] || '',
            [mappings.ibanField]: f[mappings.ibanField] || '',
            [mappings.websiteField]: f[mappings.websiteField] || ''
        });
    }, [promoter, mappings]);

    if (!open) return null;

    const setField = (key, val) => setValues(prev => ({...prev, [key]: val}));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-gray700 rounded-lg shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-gray800 dark:text-gray-gray100">Your Company</h2>
                    <button onClick={onClose} className="text-gray-gray500 hover:text-gray-gray700 dark:text-gray-gray300 dark:hover:text-gray-gray100">✕</button>
                </div>
                {error ? (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">{error}</div>
                ) : null}
                {saveError ? (
                    <div className="mb-4 p-3 bg-red-red bg-opacity-10 border border-red-red rounded text-red-red text-sm">{String(saveError)}</div>
                ) : null}
                {saveSuccess ? (
                    <div className="mb-4 p-3 bg-green-green bg-opacity-10 border border-green-green rounded text-green-green text-sm">Profile Saved</div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldRow label="Company Name" value={values[mappings.companyNameField]} editable={editable} onChange={(v) => setField(mappings.companyNameField, v)} />
                    <FieldRow label="Address" value={values[mappings.addressField]} editable={editable} onChange={(v) => setField(mappings.addressField, v)} />
                    <FieldRow label="Zipcode" value={values[mappings.zipcodeField]} editable={editable} onChange={(v) => setField(mappings.zipcodeField, v)} />
                    <FieldRow label="City" value={values[mappings.cityField]} editable={editable} onChange={(v) => setField(mappings.cityField, v)} />
                    <FieldRow label="COC" value={values[mappings.cocField]} editable={editable} onChange={(v) => setField(mappings.cocField, v)} type="number" />
                    <FieldRow label="VAT ID" value={values[mappings.vatIdField]} editable={editable} onChange={(v) => setField(mappings.vatIdField, v)} />
                    <FieldRow label="IBAN" value={values[mappings.ibanField]} editable={editable} onChange={(v) => setField(mappings.ibanField, v)} />
                    <FieldRow label="Website" value={values[mappings.websiteField]} editable={editable} onChange={(v) => setField(mappings.websiteField, v)} type="url" />
                </div>
                <div className="mt-6 flex items-center justify-end gap-3">
                    {!editable ? (
                        <button type="button" onClick={() => setEditable(true)} className="px-4 py-2 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500">Edit</button>
                    ) : (
                        <>
                            <button type="button" onClick={() => setEditable(false)} className="px-4 py-2 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded-md hover:bg-gray-gray300 dark:hover:bg-gray-gray500">Cancel</button>
                            <button type="button" disabled={saving} onClick={() => onSave(values)} className="px-4 py-2 bg-blue-blue text-white rounded-md hover:bg-opacity-90 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                        </>
                    )}
                </div>

                {/* Contacts */}
                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-gray800 dark:text-gray-gray100 mb-3">Contact Persons</h3>
                    {(!contacts || contacts.length === 0) ? (
                        <div className="text-sm text-gray-gray500 dark:text-gray-gray300">No contacts linked.</div>
                    ) : (
                        <ul className="space-y-4">
                            {contacts.map((c) => (
                                <ContactCard key={c.id} contact={c} mappings={mappings} onSaveContact={onSaveContact} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

function ContactCard({contact, mappings, onSaveContact}) {
    const [editing, setEditing] = React.useState(false);
    const [local, setLocal] = React.useState({});
    React.useEffect(() => {
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
        const payload = {};
        for (const k of Object.keys(local)) {
            payload[k] = k === mappings.contactAuthorizedField ? !!local[k] : (local[k] === '' ? null : local[k]);
        }
        await onSaveContact(contact.id, payload);
        setEditing(false);
    };

    return (
        <li className="border border-gray-gray200 dark:border-gray-gray600 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-gray-gray800 dark:text-gray-gray100">
                    {(contact.fields?.[mappings.contactFirstNameField] || '') + ' ' + (contact.fields?.[mappings.contactLastNameField] || '')}
                </div>
                {!editing ? (
                    <button type="button" onClick={() => setEditing(true)} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Edit</button>
                ) : (
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 bg-gray-gray200 dark:bg-gray-gray600 text-gray-gray800 dark:text-gray-gray100 rounded hover:bg-gray-gray300 dark:hover:bg-gray-gray500 text-sm">Cancel</button>
                        <button type="button" onClick={onSave} className="px-3 py-1.5 bg-blue-blue text-white rounded hover:bg-opacity-90 text-sm">Save</button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="First name" value={local[mappings.contactFirstNameField]} editable={editing} onChange={(v) => setField(mappings.contactFirstNameField, v)} />
                <FieldRow label="Last name" value={local[mappings.contactLastNameField]} editable={editing} onChange={(v) => setField(mappings.contactLastNameField, v)} />
                <FieldRow label="Email" value={local[mappings.contactEmailField]} editable={editing} onChange={(v) => setField(mappings.contactEmailField, v)} type="email" />
                <FieldRow label="Mobile" value={local[mappings.contactMobileField]} editable={editing} onChange={(v) => setField(mappings.contactMobileField, v)} />
                <div>
                    <label className="block text-xs uppercase text-gray-gray500 dark:text-gray-gray400 mb-1">Authorized to sign</label>
                    {editing ? (
                        <input type="checkbox" checked={!!local[mappings.contactAuthorizedField]} onChange={(e) => setField(mappings.contactAuthorizedField, e.target.checked)} />
                    ) : (
                        <div className="px-3 py-2 bg-gray-gray50 dark:bg-gray-gray800 rounded-md border border-gray-gray200 dark:border-gray-gray600">
                            <input type="checkbox" checked={!!contact.fields?.[mappings.contactAuthorizedField]} readOnly disabled />
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}


