// @ts-nocheck
import React from 'react';
import Papa from 'papaparse';

export default function ImportPage() {
    const [selectedFile, setSelectedFile] = React.useState(null);
    const [csvData, setCsvData] = React.useState([]);
    const [headers, setHeaders] = React.useState([]);
    const [errors, setErrors] = React.useState([]);
    const [isParsing, setIsParsing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [importSuccess, setImportSuccess] = React.useState(false);
    const [importedCount, setImportedCount] = React.useState(0);
    const [expiryDate, setExpiryDate] = React.useState(() => {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear.toISOString().split('T')[0];
    });

    const requiredHeaders = ['lrn', 'first_name', 'last_name', 'gender', 'parent_email', 'section'];

    function validateRows(parsedRows, parsedHeaders) {
        const validationErrors = [];
        const missingHeaders = requiredHeaders.filter((h) => !parsedHeaders.includes(h));
        if (missingHeaders.length > 0) {
            validationErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
            return validationErrors;
        }

        const ids = new Set();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        parsedRows.forEach((row, index) => {
            const rowNum = index + 1;
            const lrn = (row.lrn || '').trim();
            const first = (row.first_name || '').trim();
            const last = (row.last_name || '').trim();
            const gender = (row.gender || '').trim().toLowerCase();
            const email = (row.parent_email || '').trim();
            const section = (row.section || '').trim();

            if (!lrn) validationErrors.push(`Row ${rowNum}: LRN is required.`);
            if (!first) validationErrors.push(`Row ${rowNum}: First Name is required.`);
            if (!last) validationErrors.push(`Row ${rowNum}: Last Name is required.`);
            if (!section) validationErrors.push(`Row ${rowNum}: Section is required.`);

            if (lrn) {
                if (ids.has(lrn)) validationErrors.push(`Row ${rowNum}: Duplicate LRN (${lrn}) in CSV.`);
                ids.add(lrn);
            }

            if (!gender || !['male', 'female'].includes(gender)) {
                validationErrors.push(`Row ${rowNum}: Gender must be Male or Female.`);
            }
            if (!email || !emailRegex.test(email)) {
                validationErrors.push(`Row ${rowNum}: Parent email is invalid.`);
            }
        });

        return validationErrors;
    }

    function handleFileChange(file) {
        setSelectedFile(file || null);
        setCsvData([]);
        setHeaders([]);
        setErrors([]);
    }

    function parseCsv() {
        if (!selectedFile) return;
        setIsParsing(true);
        setErrors([]);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            comments: '#',
            transformHeader: (h) => h.trim().replace(/^\ufeff/, ''),
            complete: (results) => {
                const parsedHeaders = results.meta.fields || [];
                const parsedRows = results.data || [];
                const validationErrors = validateRows(parsedRows, parsedHeaders);

                setHeaders(parsedHeaders);
                setCsvData(parsedRows);
                setErrors(validationErrors);
                setIsParsing(false);
            },
            error: (err) => {
                setErrors([`Parse Error: ${err.message}`]);
                setIsParsing(false);
            }
        });
    }

    async function saveImport() {
        if (errors.length > 0 || csvData.length === 0) return;
        const client = window.supabaseClient;
        if (!client) {
            setErrors(['Database connection error.']);
            return;
        }

        setIsSaving(true);
        try {
            const payload = csvData.map((row) => ({
                student_id: String(row.lrn || '').trim(),
                first_name: String(row.first_name || '').trim(),
                last_name: String(row.last_name || '').trim(),
                gender: String(row.gender || '').trim(),
                parent_email: String(row.parent_email || '').trim().toLowerCase(),
                section: String(row.section || '').trim(),
                grade_level: String(row.grade_level || '').trim() || null,
                valid_until: row.valid_until ? String(row.valid_until).trim() : expiryDate
            }));

            // Check for existing LRNs
            const lrnList = payload.map(p => p.student_id);
            const { data: existingStudents, error: checkError } = await client
                .from('students')
                .select('student_id')
                .in('student_id', lrnList);

            if (checkError) throw checkError;

            if (existingStudents && existingStudents.length > 0) {
                const duplicates = existingStudents.map(s => s.student_id).join(', ');
                throw new Error(`The following LRNs already exist in the database: ${duplicates}`);
            }

            const { error } = await client
                .from('students')
                .insert(payload);

            if (error) throw error;
            setImportedCount(payload.length);
            setImportSuccess(true);
        } catch (err) {
            setErrors([`Import failed: ${err.message}`]);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="import-container">
            <div className="import-card">
                <div className="import-card-header">
                    <h3 className="import-card-title">Student Records Import</h3>
                    <p className="import-card-subtitle">Upload your CSV file to import students directly into the database.</p>
                    <div style={{ marginTop: '15px', padding: '15px', background: '#fff8e1', borderLeft: '4px solid #ffb300', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5 }}>
                        <strong>Required Columns:</strong> <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>lrn</code>, <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>first_name</code>, <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>last_name</code>, <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>gender</code>, <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>parent_email</code>, <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '4px' }}>section</code>
                        <div style={{ marginTop: '8px' }}>
                            <a href="/csv_template.csv" download className="template-link" style={{ color: '#15803d', fontWeight: 600, textDecoration: 'none' }}>
                                Download CSV Template
                            </a>
                        </div>
                    </div>
                </div>

                <div className="upload-area">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(e.target.files?.[0])}
                    />
                    {selectedFile && (
                        <div className="file-info" style={{ marginTop: '10px', display: 'flex' }}>
                            <div className="file-details">
                                <div className="file-name-group">
                                    <span className="file-name">{selectedFile.name}</span>
                                    <span className="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="import-actions">
                    <button className="import-btn" onClick={parseCsv} disabled={!selectedFile || isParsing}>
                        {isParsing ? 'Parsing...' : 'Process Import'}
                    </button>
                </div>

                {errors.length > 0 && (
                    <div style={{ marginTop: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>
                        <strong style={{ color: '#991b1b' }}>Import Errors</strong>
                        <ul style={{ marginTop: '8px', color: '#991b1b', paddingLeft: '20px' }}>
                            {errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            {csvData.length > 0 && (
                <div className="preview-panel" style={{ display: 'block' }}>
                    <div className="preview-header">
                        <h3 className="preview-title">Data Preview</h3>
                        <span className="preview-count">{csvData.length} records found</span>
                    </div>
                    <div className="preview-footer" style={{ marginBottom: '15px' }}>
                        <div className="validity-settings" style={{ marginBottom: '20px', textAlign: 'left', background: '#fff8e1', padding: '15px', borderRadius: '8px', border: '1px solid #ffcc33' }}>
                            <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px', color: '#860108', fontSize: '14px' }}>Batch QR Expiration Date</label>
                            <input type="date" className="form-input" style={{ maxWidth: '200px', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px' }} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="preview-table-container">
                        <table className="preview-table">
                            <thead>
                                <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {csvData.slice(0, 200).map((row, idx) => (
                                    <tr key={idx}>
                                        {headers.map((h) => <td key={`${idx}-${h}`}>{row[h]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="preview-footer">
                        <p className="preview-instruction">Please review the data before finalizing the import.</p>
                        <button className="confirm-import-btn" onClick={saveImport} disabled={isSaving || errors.length > 0}>
                            {isSaving ? 'Saving...' : 'Confirm and Save'}
                        </button>
                    </div>
                </div>
            )}

            {importSuccess && (
                <div className="modal-overlay" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="modal-content" style={{ background: 'white', maxWidth: '400px', width: '90%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', animation: 'modalSlideUp 0.3s ease-out' }}>
                        <div className="modal-body" style={{ padding: '30px', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 700, color: '#111827' }}>Import Successful!</h3>
                            <p style={{ margin: '0 0 24px 0', color: '#4b5563', fontSize: '15px' }}>
                                Successfully processed and imported <strong>{importedCount}</strong> student record{importedCount !== 1 ? 's' : ''}.
                            </p>
                            <button onClick={() => window.location.href = 'dashboard'} style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={(e) => e.target.style.background = '#15803d'} onMouseOut={(e) => e.target.style.background = '#16a34a'}>
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


