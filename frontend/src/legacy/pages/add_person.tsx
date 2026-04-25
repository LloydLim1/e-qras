// @ts-nocheck
import React from 'react';

/* Auto-extracted from add_person.php */

export default function AddPersonApp() {
    React.useEffect(() => {
        // Redirect guard role away from this page
        const role = (localStorage.getItem('userRole') || '').toLowerCase();
        if (role === 'guard') {
            window.location.replace('/dashboard');
            return;
        }
        initAddPersonPage();
    }, []);

    return (
        <div className="import-container">
            <div className="import-card">
                <div className="import-card-header">
                    <h3 className="import-card-title">Add Person</h3>
                    <p className="import-card-subtitle">Add a new person to the system by selecting their role and entering their information.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="personType" className="form-label">Person Type</label>
                    <select id="personType" className="form-select" onChange={updateFormFields}>
                        <option value="">Select Person Type</option>
                        <option value="admin">Admin</option>
                        <option value="teacher">Teacher</option>
                        <option value="guard">Guard</option>
                    </select>
                </div>

                <div id="formFields" style={{ display: 'none' }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName" className="form-label">First Name</label>
                            <input type="text" id="firstName" className="form-input" placeholder="Enter first name" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName" className="form-label">Last Name</label>
                            <input type="text" id="lastName" className="form-input" placeholder="Enter last name" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email</label>
                            <input type="email" id="email" className="form-input" placeholder="Enter email address" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="phone" className="form-label">Phone Number</label>
                            <input type="tel" id="phone" className="form-input" placeholder="Enter phone number" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password" className="form-label">Password</label>
                            <div className="password-container">
                                <input type="password" id="password" className="form-input" placeholder="Enter password (default: password123)" />
                                <span className="password-toggle" onClick={() => togglePasswordVisibility('password')}>
                                    <svg className="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="birthday" className="form-label">Birthday</label>
                            <input type="date" id="birthday" className="form-input" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sex" className="form-label">Sex</label>
                            <select id="sex" className="form-select">
                                <option value="">Select Sex</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group" id="advisoryGroup" style={{ display: 'none' }}>
                            <label htmlFor="advisoryClass" className="form-label">Advisory Class</label>
                            <select id="advisoryClass" className="form-select">
                                <option value="">Select Advisory Class</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="import-btn" id="addPersonBtn" onClick={addPerson}>Add Person</button>
                    </div>
                </div>
            </div>
        </div>
    );
}


function initAddPersonPage() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('personType')) {
        setTimeout(initAddPersonPage, 50);
        return;
    }
    updateFormFields();
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('.eye-icon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

function updateFormFields() {
    const personType = document.getElementById('personType').value;
    const formFields = document.getElementById('formFields');
    const advisoryGroup = document.getElementById('advisoryGroup');

    if (personType) {
        formFields.style.display = 'block';

        if (personType === 'teacher') {
            advisoryGroup.style.display = 'block';
            loadAdvisoryClasses();
        } else {
            advisoryGroup.style.display = 'none';
        }
    } else {
        formFields.style.display = 'none';
    }
}

async function loadAdvisoryClasses() {
    const client = window.supabaseClient;
    if (!client) return;

    try {
        const { data: sections, error } = await client
            .from('students')
            .select('section, grade_level')
            .order('grade_level', { ascending: true })
            .order('section', { ascending: true });

        if (error) throw error;

        const classMap = {};
        sections.forEach(s => {
            const key = `${s.grade_level} - ${s.section}`;
            classMap[key] = true;
        });

        const advisorySelect = document.getElementById('advisoryClass');
        advisorySelect.innerHTML = '<option value="">Select Advisory Class</option>';

        Object.keys(classMap).sort().forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            advisorySelect.appendChild(option);
        });

    } catch (err) {
        console.error('Error loading advisory classes:', err);
    }
}

async function addPerson() {
    const personType = document.getElementById('personType').value;
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();

    const phoneElement = document.getElementById('phone');
    const phone = phoneElement ? phoneElement.value.trim() : '';

    const birthday = document.getElementById('birthday').value;
    const sex = document.getElementById('sex').value;
    const advisoryClass = document.getElementById('advisoryClass').value;

    if (!personType || !firstName || !lastName || !email || !birthday || !sex) {
        alert('Please fill in all required fields.');
        return;
    }

    if (personType === 'teacher' && !advisoryClass) {
        alert('Please select an advisory class for the teacher.');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    const client = window.supabaseClient;
    if (!client) {
        alert('Database connection not available. Please check your internet connection or Supabase configuration.');
        return;
    }

    const addBtn = document.getElementById('addPersonBtn');
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    try {
        const username = email.split('@')[0];

        const passwordElement = document.getElementById('password');
        let passwordInput = passwordElement ? passwordElement.value.trim() : '';
        if (!passwordInput) {
            passwordInput = 'password123';
        }

        const salt = dcodeIO.bcrypt.genSaltSync(10);
        const hashedPassword = dcodeIO.bcrypt.hashSync(passwordInput, salt);

        const personData = {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            email: email,
            username: username,
            password: hashedPassword,
            phone: phone,
            birthday: birthday,
            sex: sex,
            role: personType,
            created_at: new Date().toISOString()
        };

        if (personType === 'teacher') {
            personData.advisory_class = advisoryClass;
        } else {
            personData.advisory_class = null;
        }

        const { error: userError } = await client
            .from('users')
            .insert([personData])
            .select()
            .single();

        if (userError) throw userError;

        alert(`Successfully added ${personType}: ${firstName} ${lastName}`);

        document.getElementById('personType').value = '';
        updateFormFields();

        document.getElementById('firstName').value = '';
        document.getElementById('lastName').value = '';
        document.getElementById('email').value = '';
        if (passwordElement) passwordElement.value = '';
        if (phoneElement) phoneElement.value = '';
        document.getElementById('birthday').value = '';
        document.getElementById('sex').value = '';
        document.getElementById('advisoryClass').value = '';

    } catch (err) {
        console.error('Error adding person:', err);
        let errorMessage = 'Failed to add person.';

        if (err.code === '23505') {
            errorMessage = 'A user with this email address or username already exists.';
        } else {
            errorMessage += ' ' + (err.message || err.details || '');
        }

        alert(errorMessage);
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Person';
    }
}


