// Data storage - organized by section
let sectionStudents = {}; // {section: [names]}
let sectionData = {}; // {section: {name: {closeTies: [], wish: "", wishGrants: []}}}
let currentSection = ''; // Currently selected section
let pendingTab = null; // Tab waiting for password authentication
const INSTRUCTOR_PASSWORD = 'password';

// Firebase helpers
async function saveToFirebase() {
    if (!window.firebaseEnabled || !window.firestore) {
        console.log('Firebase not enabled or not initialized');
        return false; // Firebase not configured
    }
    
    try {
        // Dynamically import Firebase functions
        const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { doc, setDoc } = firestoreModule;
        
        console.log('Saving to Firebase...', { sectionStudents, sectionData });
        
        // Save student names
        await setDoc(doc(window.firestore, 'data', 'sectionStudents'), {
            data: sectionStudents,
            updatedAt: new Date().toISOString()
        });
        console.log('Saved sectionStudents to Firebase');
        
        // Save section data
        await setDoc(doc(window.firestore, 'data', 'sectionData'), {
            data: sectionData,
            updatedAt: new Date().toISOString()
        });
        console.log('Saved sectionData to Firebase');
        
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        console.error('Error details:', error.message, error.code);
        return false;
    }
}

async function loadFromFirebase() {
    if (!window.firebaseEnabled || !window.firestore) {
        return false; // Firebase not configured
    }
    
    try {
        // Dynamically import Firebase functions
        const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { doc, getDoc, onSnapshot } = firestoreModule;
        
        // Load initial data
        const studentsDoc = await getDoc(doc(window.firestore, 'data', 'sectionStudents'));
        const dataDoc = await getDoc(doc(window.firestore, 'data', 'sectionData'));
        
        if (studentsDoc.exists()) {
            const data = studentsDoc.data();
            if (data.data) {
                Object.assign(sectionStudents, data.data);
            }
        }
        
        if (dataDoc.exists()) {
            const data = dataDoc.data();
            if (data.data) {
                Object.assign(sectionData, data.data);
            }
        }
        
        // Set up real-time listeners
        onSnapshot(doc(window.firestore, 'data', 'sectionStudents'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.data) {
                    Object.assign(sectionStudents, data.data);
                    // Only update UI if user doesn't have in-progress data
                    if (!hasInProgressWishData()) {
                        updateUI();
                    }
                }
            }
        });
        
        onSnapshot(doc(window.firestore, 'data', 'sectionData'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.data) {
                    Object.assign(sectionData, data.data);
                    // Update tabs if they're visible, but preserve in-progress data
                    const activeTab = document.querySelector('.tab-content.active');
                    if (activeTab) {
                        if (activeTab.id === 'wish') {
                            // Always update wish tab, but it will preserve in-progress data
                            updateWishTab();
                        } else if (activeTab.id === 'grant') {
                            // Always update grant tab, but it will preserve selections
                            updateGrantTab();
                        }
                    } else {
                        // No active tab, safe to update UI
                        updateUI();
                    }
                }
            }
        });
        
        return true;
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        return false;
    }
}

// Test Firebase connection (can be called from browser console)
window.testFirebase = async function() {
    console.log('Testing Firebase connection...');
    console.log('Firebase enabled:', window.firebaseEnabled);
    console.log('Firestore instance:', window.firestore);
    
    if (!window.firebaseEnabled || !window.firestore) {
        console.error('Firebase not initialized!');
        return;
    }
    
    try {
        const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { doc, setDoc, getDoc } = firestoreModule;
        
        // Try to write a test document
        const testDoc = doc(window.firestore, 'test', 'connection');
        await setDoc(testDoc, {
            message: 'Firebase is working!',
            timestamp: new Date().toISOString()
        });
        console.log('✅ Successfully wrote test document to Firestore');
        
        // Try to read it back
        const testRead = await getDoc(testDoc);
        if (testRead.exists()) {
            console.log('✅ Successfully read test document:', testRead.data());
        } else {
            console.error('❌ Test document not found after writing');
        }
        
        // Try to save actual data
        console.log('Attempting to save actual data...');
        const result = await saveToFirebase();
        if (result) {
            console.log('✅ Successfully saved data to Firestore');
        } else {
            console.error('❌ Failed to save data to Firestore');
        }
        
    } catch (error) {
        console.error('❌ Firebase test failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        if (error.code === 'permission-denied') {
            console.error('⚠️ PERMISSION DENIED - Check your Firestore security rules!');
            console.error('See FIRESTORE_SECURITY_RULES.md for instructions');
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    await loadData();
    // Initialize sections if they don't exist
    ['A', 'B', 'C', 'D'].forEach(section => {
        if (!sectionStudents[section]) {
            sectionStudents[section] = [];
        }
        if (!sectionData[section]) {
            sectionData[section] = {};
        }
    });
    
    // Check for hash URL and switch to appropriate tab
    const hash = window.location.hash.substring(1); // Remove the #
    if (hash && ['wish', 'grant', 'setup', 'networks'].includes(hash)) {
        if (requiresAuth(hash) && !isAuthenticated()) {
            // Protected tab - show password prompt or redirect to student tab
            showPasswordPrompt(hash);
            switchToTab('wish'); // Default to wish tab while waiting for password
        } else {
            switchToTab(hash);
        }
    } else {
        // Check if any protected tab is active by default and require authentication
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            if (requiresAuth(tabId) && !isAuthenticated()) {
                // Switch to student tab if protected tab is active
                switchToTab('wish');
            }
        }
    }
    
    updateUI();
});

// Listen for hash changes (when user navigates via QR code or link)
window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1);
    if (hash && ['wish', 'grant', 'setup', 'networks'].includes(hash)) {
        if (requiresAuth(hash) && !isAuthenticated()) {
            showPasswordPrompt(hash);
            switchToTab('wish');
        } else {
            switchToTab(hash);
        }
    }
});

// Get current section based on active tab
function getCurrentSection(tab) {
    if (tab === 'setup') {
        return document.getElementById('sectionSetup') ? document.getElementById('sectionSetup').value : '';
    } else if (tab === 'wish') {
        return document.getElementById('sectionWish') ? document.getElementById('sectionWish').value : '';
    } else if (tab === 'grant') {
        return document.getElementById('sectionGrant') ? document.getElementById('sectionGrant').value : '';
    } else if (tab === 'network') {
        return document.getElementById('sectionNetwork') ? document.getElementById('sectionNetwork').value : '';
    }
    return currentSection;
}

// Handle section change
function onSectionChange(tab) {
    const section = getCurrentSection(tab);
    currentSection = section;
    
    if (tab === 'setup' && section) {
        // Load student names for the selected section
        const studentNamesInput = document.getElementById('studentNames');
        const sectionInfo = document.getElementById('sectionInfo');
        if (studentNamesInput) {
            if (sectionStudents[section] && sectionStudents[section].length > 0) {
                studentNamesInput.value = sectionStudents[section].join('\n');
                if (sectionInfo) {
                    sectionInfo.textContent = `Currently viewing Section ${section} (${sectionStudents[section].length} students saved)`;
                }
            } else {
                studentNamesInput.value = '';
                if (sectionInfo) {
                    sectionInfo.textContent = `Currently editing Section ${section} (no students saved yet)`;
                }
            }
        }
    } else if (section) {
        updateUI();
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return sessionStorage.getItem('instructorAuthenticated') === 'true';
}

// Set authentication status
function setAuthenticated(status) {
    sessionStorage.setItem('instructorAuthenticated', status ? 'true' : 'false');
}

// Check if tab requires authentication
function requiresAuth(tabName) {
    return tabName === 'setup' || tabName === 'networks';
}

// Show password prompt
function showPasswordPrompt(tabName) {
    pendingTab = tabName;
    const overlay = document.getElementById('passwordOverlay');
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('passwordError');
    
    if (overlay) {
        overlay.classList.add('active');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
    }
}

// Hide password prompt
function hidePasswordPrompt() {
    const overlay = document.getElementById('passwordOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    pendingTab = null;
}

// Check password
function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('passwordError');
    
    if (!passwordInput) return;
    
    const enteredPassword = passwordInput.value.trim();
    
    if (enteredPassword === INSTRUCTOR_PASSWORD) {
        setAuthenticated(true);
        hidePasswordPrompt();
        // Now switch to the pending tab
        if (pendingTab) {
            switchToTab(pendingTab);
        }
    } else {
        if (errorDiv) {
            errorDiv.classList.add('show');
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
}

// Cancel password entry
function cancelPassword() {
    hidePasswordPrompt();
    // Return to first non-protected tab
    switchToTab('wish');
}

// Handle Enter key in password input
function handlePasswordKeyPress(event) {
    if (event.key === 'Enter') {
        checkPassword();
    }
}

// Tab switching (public function - checks authentication)
function showTab(tabName, buttonElement) {
    // Check if this tab requires authentication
    if (requiresAuth(tabName) && !isAuthenticated()) {
        showPasswordPrompt(tabName);
        return;
    }
    
    // If authenticated or doesn't require auth, proceed
    switchToTab(tabName);
}

    // Actually switch to a tab (internal function)
function switchToTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    const tabElement = document.getElementById(tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Activate the corresponding tab button
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(btn => {
        // Check which tab this button corresponds to
        const btnText = btn.textContent.toLowerCase();
        let isActive = false;
        
        if (tabName === 'setup' && btnText.includes('setup')) {
            isActive = true;
        } else if (tabName === 'wish' && btnText.includes('wish')) {
            isActive = true;
        } else if (tabName === 'grant' && btnText.includes('grant')) {
            isActive = true;
        } else if (tabName === 'networks' && btnText.includes('network')) {
            isActive = true;
        }
        
        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update URL hash for QR code navigation
    if (tabName && ['wish', 'grant', 'setup', 'networks'].includes(tabName)) {
        window.location.hash = tabName;
    }
    
    // Update UI when switching tabs
    if (tabName === 'wish') {
        updateWishTab();
    } else if (tabName === 'grant') {
        updateGrantTab();
    } else if (tabName === 'setup') {
        // Load student names for selected section when switching to setup tab
        const section = getCurrentSection('setup');
        const studentNamesInput = document.getElementById('studentNames');
        const sectionInfo = document.getElementById('sectionInfo');
        
        if (studentNamesInput) {
            if (section && sectionStudents[section] && sectionStudents[section].length > 0) {
                studentNamesInput.value = sectionStudents[section].join('\n');
                if (sectionInfo) {
                    sectionInfo.textContent = `Currently viewing Section ${section} (${sectionStudents[section].length} students saved)`;
                }
            } else {
                studentNamesInput.value = '';
                if (sectionInfo) {
                    if (section) {
                        sectionInfo.textContent = `Currently editing Section ${section} (no students saved yet)`;
                    } else {
                        sectionInfo.textContent = 'Please select a section to view or edit student names';
                    }
                }
            }
        }
    }
}

// Save student names
function saveStudentNames() {
    const section = getCurrentSection('setup');
    if (!section) {
        showMessage('setupMessage', 'Please select a section first.', 'error');
        return;
    }

    const namesText = document.getElementById('studentNames').value.trim();
    if (!namesText) {
        showMessage('setupMessage', 'Please enter at least one student name.', 'error');
        return;
    }

    const names = namesText.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

    if (names.length === 0) {
        showMessage('setupMessage', 'Please enter at least one student name.', 'error');
        return;
    }

    // Remove duplicates
    sectionStudents[section] = [...new Set(names)];
    
    // Initialize section data if needed
    if (!sectionData[section]) {
        sectionData[section] = {};
    }

    saveData();
    updateUI();
    
    // Update section info display
    const sectionInfo = document.getElementById('sectionInfo');
    if (sectionInfo) {
        sectionInfo.textContent = `Section ${section} (${sectionStudents[section].length} students saved)`;
    }
    
    showMessage('setupMessage', `Saved ${sectionStudents[section].length} student names for Section ${section}!`, 'success');
}

// Export student names to a downloadable JSON file (for GitHub)
function exportStudentNamesToFile() {
    const dataStr = JSON.stringify(sectionStudents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showMessage('setupMessage', 'Student names exported to students.json file. You can commit this file to GitHub.', 'success');
}

// Download wish grant report showing who granted each wish
function downloadWishGrantReport() {
    // Check authentication
    if (!isAuthenticated()) {
        showPasswordPrompt('setup');
        return;
    }

    let reportContent = 'Wish Grant Report\n';
    reportContent += '==================\n\n';
    reportContent += 'This report shows who made each wish and who offered to grant it.\n';
    reportContent += 'Use this to connect students after class.\n\n';
    reportContent += 'Generated: ' + new Date().toLocaleString() + '\n';
    reportContent += '='.repeat(80) + '\n\n';
    
    // Process each section
    ['A', 'B', 'C', 'D'].forEach(section => {
        const sectionDataForSection = sectionData[section] || {};
        
        // Find all students who made wishes
        const studentsWithWishes = Object.keys(sectionDataForSection).filter(name => {
            const data = sectionDataForSection[name];
            return data && data.wish && data.wish.trim() !== '';
        });
        
        if (studentsWithWishes.length === 0) {
            return; // Skip empty sections
        }
        
        reportContent += `SECTION ${section}\n`;
        reportContent += '='.repeat(80) + '\n\n';
        
        // For each student who made a wish, find who granted it
        studentsWithWishes.forEach(wishMaker => {
            const wishData = sectionDataForSection[wishMaker];
            const wish = wishData.wish || '(No wish entered)';
            
            // Find all students who granted this person's wish
            const granters = Object.keys(sectionDataForSection).filter(granter => {
                const granterData = sectionDataForSection[granter];
                return granterData && 
                       granterData.wishGrants && 
                       Array.isArray(granterData.wishGrants) &&
                       granterData.wishGrants.includes(wishMaker);
            });
            
            reportContent += `Wish Maker: ${wishMaker}\n`;
            reportContent += `Wish: ${wish}\n`;
            
            if (granters.length > 0) {
                reportContent += `Granted by (${granters.length}): ${granters.join(', ')}\n`;
            } else {
                reportContent += `Granted by: (No one has offered to grant this wish yet)\n`;
            }
            
            reportContent += '\n' + '-'.repeat(80) + '\n\n';
        });
        
        reportContent += '\n';
    });
    
    // Also create CSV version
    let csvContent = 'Section,Student Name,Wish,Number of Granters,Granters\n';
    
    ['A', 'B', 'C', 'D'].forEach(section => {
        const sectionDataForSection = sectionData[section] || {};
        const studentsWithWishes = Object.keys(sectionDataForSection).filter(name => {
            const data = sectionDataForSection[name];
            return data && data.wish && data.wish.trim() !== '';
        });
        
        studentsWithWishes.forEach(wishMaker => {
            const wishData = sectionDataForSection[wishMaker];
            const wish = wishData.wish || '(No wish entered)';
            
            const granters = Object.keys(sectionDataForSection).filter(granter => {
                const granterData = sectionDataForSection[granter];
                return granterData && 
                       granterData.wishGrants && 
                       Array.isArray(granterData.wishGrants) &&
                       granterData.wishGrants.includes(wishMaker);
            });
            
            // Escape CSV fields (handle quotes and commas)
            const escapeCSV = (str) => {
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            };
            
            csvContent += `${section},${escapeCSV(wishMaker)},${escapeCSV(wish)},${granters.length},"${granters.join('; ')}"\n`;
        });
    });
    
    // Download both formats
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    
    // Download text report
    const textBlob = new Blob([reportContent], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `wish-grant-report-${timestamp}.txt`;
    document.body.appendChild(textLink);
    textLink.click();
    document.body.removeChild(textLink);
    URL.revokeObjectURL(textUrl);
    
    // Download CSV report
    setTimeout(() => {
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `wish-grant-report-${timestamp}.csv`;
        document.body.appendChild(csvLink);
        csvLink.click();
        document.body.removeChild(csvLink);
        URL.revokeObjectURL(csvUrl);
        
        showMessage('setupMessage', 'Wish grant report downloaded! Both TXT and CSV formats are available.', 'success');
    }, 500);
}

// Check if user has in-progress wish data (not yet submitted)
function hasInProgressWishData() {
    const studentSelect = document.getElementById('studentNameWish');
    const wishInput = document.getElementById('wishInput');
    const closeTiesDiv = document.getElementById('closeTies');
    
    // Check if user has selected a student
    const hasStudent = studentSelect && studentSelect.value && studentSelect.value.trim() !== '';
    
    // Check if user has entered a wish
    const hasWish = wishInput && wishInput.value && wishInput.value.trim() !== '';
    
    // Check if user has selected any close ties
    const hasCloseTies = closeTiesDiv && document.querySelectorAll('#closeTies input[type="checkbox"]:checked').length > 0;
    
    // Return true if user has any in-progress data
    return hasStudent && (hasWish || hasCloseTies);
}

// Update UI elements
function updateUI() {
    updateWishTab();
    updateGrantTab();
}

// Update close ties selection count display
function updateCloseTiesCount() {
    const countDisplay = document.getElementById('closeTiesSelected');
    if (countDisplay) {
        const checkedCount = document.querySelectorAll('#closeTies input[type="checkbox"]:checked').length;
        countDisplay.textContent = checkedCount;
        
        // Update color based on count
        const countContainer = document.getElementById('closeTiesCount');
        if (countContainer) {
            if (checkedCount > 20) {
                countContainer.style.background = '#ffe6e6';
                countContainer.style.color = '#dc3545';
            } else if (checkedCount === 20) {
                countContainer.style.background = '#fff3cd';
                countContainer.style.color = '#856404';
            } else {
                countContainer.style.background = '#e8f4f8';
                countContainer.style.color = '#667eea';
            }
        }
    }
}

// Update wish tab (Phase 1)
function updateWishTab() {
    const section = getCurrentSection('wish');
    const studentSelect = document.getElementById('studentNameWish');
    const closeTiesDiv = document.getElementById('closeTies');
    const wishInput = document.getElementById('wishInput');

    // Preserve current form state before updating - do this FIRST
    const currentStudent = studentSelect ? studentSelect.value : '';
    const currentWish = wishInput ? wishInput.value : '';
    const currentCheckedBoxes = new Set();
    if (closeTiesDiv) {
        document.querySelectorAll('#closeTies input[type="checkbox"]:checked').forEach(cb => {
            currentCheckedBoxes.add(cb.value);
        });
    }
    
    // If user has in-progress data, only update student dropdown if needed, don't rebuild checkboxes
    const hasInProgress = currentStudent && (currentWish || currentCheckedBoxes.size > 0);
    
    // Update student dropdown based on selected section
    if (studentSelect) {
        const wasEmpty = studentSelect.value === '';
        const currentOptions = Array.from(studentSelect.options).map(opt => opt.value);
        const newStudents = section && sectionStudents[section] ? sectionStudents[section] : [];
        const studentsChanged = JSON.stringify(currentOptions.sort()) !== JSON.stringify(['', ...newStudents].sort());
        
        // Only rebuild dropdown if students list changed
        if (studentsChanged) {
            studentSelect.innerHTML = '<option value="">Select your name...</option>';
            if (section && sectionStudents[section]) {
                sectionStudents[section].forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    studentSelect.appendChild(option);
                });
            }
            // Restore selected student if it still exists
            if (currentStudent && !wasEmpty && newStudents.includes(currentStudent)) {
                studentSelect.value = currentStudent;
            }
        }
    }

    // Only rebuild checkboxes if user doesn't have in-progress data OR if student list changed
    if (closeTiesDiv && !hasInProgress) {
        closeTiesDiv.innerHTML = '';
        if (section && sectionStudents[section]) {
            sectionStudents[section].forEach(name => {
                const div = document.createElement('div');
                div.className = 'checkbox-item';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `close-${section}-${name}`;
                checkbox.value = name;
                
                // Restore checked state if it was checked before
                if (currentCheckedBoxes.has(name)) {
                    checkbox.checked = true;
                }
                
                // Add change event listener to enforce 20 person limit
                checkbox.addEventListener('change', function() {
                    const checkedCount = document.querySelectorAll('#closeTies input[type="checkbox"]:checked').length;
                    if (checkedCount > 20 && this.checked) {
                        // If already over limit, prevent checking this one
                        this.checked = false;
                        showMessage('wishMessage', 'You can only select up to 20 people. Please uncheck someone else first.', 'error');
                    }
                    updateCloseTiesCount();
                });
                
                const label = document.createElement('label');
                label.htmlFor = `close-${section}-${name}`;
                label.textContent = name;
                div.appendChild(checkbox);
                div.appendChild(label);
                closeTiesDiv.appendChild(div);
            });
        }
    } else if (closeTiesDiv && hasInProgress) {
        // User has in-progress data - just ensure all students are in the list
        // Check if any new students need to be added
        const existingCheckboxes = Array.from(closeTiesDiv.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);
        const allStudents = section && sectionStudents[section] ? sectionStudents[section] : [];
        const missingStudents = allStudents.filter(name => !existingCheckboxes.includes(name));
        
        // Add any missing students (new students added to the list)
        missingStudents.forEach(name => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `close-${section}-${name}`;
            checkbox.value = name;
            
            checkbox.addEventListener('change', function() {
                const checkedCount = document.querySelectorAll('#closeTies input[type="checkbox"]:checked').length;
                if (checkedCount > 20 && this.checked) {
                    this.checked = false;
                    showMessage('wishMessage', 'You can only select up to 20 people. Please uncheck someone else first.', 'error');
                }
                updateCloseTiesCount();
            });
            
            const label = document.createElement('label');
            label.htmlFor = `close-${section}-${name}`;
            label.textContent = name;
            div.appendChild(checkbox);
            div.appendChild(label);
            closeTiesDiv.appendChild(div);
        });
    }
    
    // Always restore wish text (it won't be cleared if we didn't rebuild)
    if (wishInput && currentWish) {
        wishInput.value = currentWish;
    }
    
    // Update the count display
    updateCloseTiesCount();
}

// Track selected wishes for granting
let selectedWishIds = [];

// Update grant tab (Phase 2)
function updateGrantTab() {
    const section = getCurrentSection('grant');
    const studentSelect = document.getElementById('studentNameGrant');
    const allWishesDisplay = document.getElementById('allWishesDisplay');
    const currentStudent = studentSelect ? studentSelect.value : '';

    // Update student dropdown based on selected section
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">Select your name...</option>';
        if (section && sectionStudents[section]) {
            sectionStudents[section].forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                studentSelect.appendChild(option);
            });
            // Restore selection if it was set
            if (currentStudent && sectionStudents[section].includes(currentStudent)) {
                studentSelect.value = currentStudent;
            }
        }
    }

    // Only show wishes if a student is selected and section is selected
    if (currentStudent && section) {
        // Preserve selected wishes - only reset if student actually changed
        const previousStudent = studentSelect ? studentSelect.getAttribute('data-previous-student') : null;
        if (previousStudent && previousStudent !== currentStudent) {
            selectedWishIds = []; // Reset selection only when student changes
        }
        if (studentSelect) {
            studentSelect.setAttribute('data-previous-student', currentStudent);
        }
        displayAllWishes(currentStudent, section);
        if (allWishesDisplay) {
            allWishesDisplay.style.display = 'block';
        }
        updateSelectedWishesInfo();
    } else {
        if (allWishesDisplay) {
            allWishesDisplay.style.display = 'none';
        }
    }
}

// Display all wishes in the grant tab (anonymized, clickable)
function displayAllWishes(currentStudent, section) {
    const wishesList = document.getElementById('wishesList');
    if (!wishesList || !section) return;

    const sectionStudentData = sectionData[section] || {};
    const sectionStudentsList = sectionStudents[section] || [];
    
    const studentsWithWishes = sectionStudentsList.filter(name => 
        sectionStudentData[name] && 
        sectionStudentData[name].wish && 
        sectionStudentData[name].wish.trim() !== '' &&
        name !== currentStudent // Exclude self
    );

    if (studentsWithWishes.length === 0) {
        wishesList.innerHTML = '<p style="color: #666; padding: 20px;">No other students have submitted wishes yet, or you cannot grant your own wish.</p>';
        return;
    }

    // Preserve selected wishes by mapping old IDs to new ones based on student name
    // Since wish IDs include index which might change, we'll use student name as the key
    const preservedSelections = new Set();
    selectedWishIds.forEach(oldId => {
        // Extract student name from old ID format: wish-{section}-{index}-{name}
        const match = oldId.match(/wish-[^-]+-[^-]+-(.+)$/);
        if (match) {
            preservedSelections.add(match[1]); // Store by student name
        }
    });

    let html = '';
    studentsWithWishes.forEach((name, index) => {
        const data = sectionStudentData[name];
        const wishId = `wish-${section}-${index}-${name}`; // Use section, index and name as unique ID
        // Restore selection if this student's wish was previously selected
        const wasSelected = preservedSelections.has(name);
        if (wasSelected && !selectedWishIds.includes(wishId)) {
            selectedWishIds.push(wishId);
        }
        const isSelected = selectedWishIds.includes(wishId);
        html += `<div class="wish-card ${isSelected ? 'selected' : ''}" data-wish-id="${wishId}" data-student-name="${name}" onclick="toggleWishSelection('${wishId}')">`;
        html += `<div class="wish-text">"${data.wish}"</div>`;
        html += `</div>`;
    });

    wishesList.innerHTML = html;
}

// Toggle wish selection
function toggleWishSelection(wishId) {
    const index = selectedWishIds.indexOf(wishId);
    if (index > -1) {
        // Deselect
        selectedWishIds.splice(index, 1);
    } else {
        // Select (max 3)
        if (selectedWishIds.length >= 3) {
            showMessage('grantMessage', 'You can only select up to 3 wishes.', 'error');
            return;
        }
        selectedWishIds.push(wishId);
    }
    
    // Update visual state
    const wishCard = document.querySelector(`[data-wish-id="${wishId}"]`);
    if (wishCard) {
        if (selectedWishIds.includes(wishId)) {
            wishCard.classList.add('selected');
        } else {
            wishCard.classList.remove('selected');
        }
    }
    
    updateSelectedWishesInfo();
}

// Update selected wishes info
function updateSelectedWishesInfo() {
    const infoDiv = document.getElementById('selectedWishesInfo');
    const countSpan = document.getElementById('selectedCount');
    if (infoDiv && countSpan) {
        const count = selectedWishIds.length;
        countSpan.textContent = count;
        if (count > 0) {
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    }
}

// Load wish data into form (Phase 1)
function loadWishData(name) {
    const data = studentData[name] || {closeTies: [], wish: ''};

    // Load close ties
    document.querySelectorAll('#closeTies input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = data.closeTies.includes(checkbox.value);
    });
    updateCloseTiesCount();

    // Load wish
    const wishInput = document.getElementById('wishInput');
    if (wishInput) {
        wishInput.value = data.wish || '';
    }
}

// Load grant data into form (Phase 2) - but don't show other people's selections
// Students should only see their own data when they submit, not when selecting their name

// Save wish data (Phase 1)
function saveWishData() {
    const section = getCurrentSection('wish');
    if (!section) {
        showMessage('wishMessage', 'Please select your section first.', 'error');
        return;
    }

    const studentName = document.getElementById('studentNameWish').value.trim();
    if (!studentName) {
        showMessage('wishMessage', 'Please select your name.', 'error');
        return;
    }

    // Initialize section data if needed
    if (!sectionData[section]) {
        sectionData[section] = {};
    }

    // Get close ties
    const closeTies = Array.from(document.querySelectorAll('#closeTies input[type="checkbox"]:checked'))
        .map(cb => cb.value)
        .filter(name => name !== studentName); // Remove self
    
    // Validate limit of 20 people
    if (closeTies.length > 20) {
        showMessage('wishMessage', 'You can only select up to 20 people. Please select 20 or fewer.', 'error');
        return;
    }

    // Get wish
    const wishInput = document.getElementById('wishInput');
    if (!wishInput) {
        showMessage('wishMessage', 'Wish input field not found.', 'error');
        return;
    }
    const wish = wishInput.value.trim();
    if (!wish) {
        showMessage('wishMessage', 'Please enter your wish.', 'error');
        return;
    }

    // Save data (only wish and close ties, not grants yet)
    if (!sectionData[section][studentName]) {
        sectionData[section][studentName] = {};
    }
    sectionData[section][studentName].closeTies = closeTies;
    sectionData[section][studentName].wish = wish;
    // Don't overwrite wishGrants if they exist
    if (!sectionData[section][studentName].wishGrants) {
        sectionData[section][studentName].wishGrants = [];
    }

    saveData();
    showMessage('wishMessage', 'Your wish has been saved!', 'success');

    // Clear form for next student
    setTimeout(() => {
        document.getElementById('studentNameWish').value = '';
        const wishInput = document.getElementById('wishInput');
        if (wishInput) wishInput.value = '';
        document.querySelectorAll('#closeTies input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateCloseTiesCount();
        updateCloseTiesCount();
    }, 1500);
}

// Save grant data (Phase 2)
function saveGrantData() {
    const section = getCurrentSection('grant');
    if (!section) {
        showMessage('grantMessage', 'Please select your section first.', 'error');
        return;
    }

    const studentName = document.getElementById('studentNameGrant').value.trim();
    if (!studentName) {
        showMessage('grantMessage', 'Please select your name.', 'error');
        return;
    }

    // Initialize section data if needed
    if (!sectionData[section]) {
        sectionData[section] = {};
    }

    // Get wish grants from selected wish IDs
    const wishGrants = selectedWishIds.map(wishId => {
        const wishCard = document.querySelector(`[data-wish-id="${wishId}"]`);
        return wishCard ? wishCard.getAttribute('data-student-name') : null;
    }).filter(name => name && name !== studentName); // Remove nulls and self

    if (wishGrants.length === 0 || wishGrants.length > 3) {
        showMessage('grantMessage', 'Please select 1-3 wishes that you can grant.', 'error');
        return;
    }

    // Save grant data (preserve existing closeTies and wish)
    if (!sectionData[section][studentName]) {
        sectionData[section][studentName] = {closeTies: [], wish: ''};
    }
    sectionData[section][studentName].wishGrants = wishGrants;

    saveData();
    showMessage('grantMessage', 'Your wish grants have been saved!', 'success');

    // Clear form for next student
    setTimeout(() => {
        document.getElementById('studentNameGrant').value = '';
        selectedWishIds = [];
        const allWishesDisplay = document.getElementById('allWishesDisplay');
        if (allWishesDisplay) {
            allWishesDisplay.style.display = 'none';
        }
        updateSelectedWishesInfo();
    }, 1500);
}

// Validate wish grants is now handled in toggleWishSelection

// Create anonymization mapping (name -> numeric ID) for a section
function createAnonymizationMap(section) {
    const mapping = {};
    const sectionStudentsList = sectionStudents[section] || [];
    sectionStudentsList.forEach((name, index) => {
        mapping[name] = (index + 1).toString();
    });
    return mapping;
}

// Update data preview - removed to prevent students from seeing other responses
function updateDataPreview() {
    // Data preview removed - students should not see other people's responses
}

// Display community legend with percentages
function displayCommunityLegend(communities, students, legendId, anonymize) {
    const legendContainer = document.getElementById(legendId);
    if (!legendContainer) return;
    
    if (!communities || !students || students.length === 0) {
        legendContainer.style.display = 'none';
        return;
    }
    
    // Count nodes in each community
    const communityCounts = {};
    students.forEach(name => {
        const nodeId = anonymize[name];
        const communityId = communities[nodeId] || 0;
        communityCounts[communityId] = (communityCounts[communityId] || 0) + 1;
    });
    
    const total = students.length;
    
    // Sort communities by size (largest first)
    const sortedCommunities = Object.keys(communityCounts)
        .map(id => ({
            id: parseInt(id),
            count: communityCounts[id],
            percentage: ((communityCounts[id] / total) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count);
    
    // Generate legend HTML
    let legendHTML = '<h4 style="margin-bottom: 15px; color: #667eea;">Community Distribution</h4>';
    legendHTML += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
    
    sortedCommunities.forEach(comm => {
        const color = getCommunityColor(comm.id);
        legendHTML += `
            <div class="community-legend-item">
                <div class="community-legend-color" style="background-color: ${color.background}; border-color: ${color.border || color.background};"></div>
                <div class="community-legend-text">
                    <div class="community-legend-label">Community ${comm.id + 1}</div>
                    <div class="community-legend-percentage">${comm.count} people (${comm.percentage}%)</div>
                </div>
            </div>
        `;
    });
    
    legendHTML += '</div>';
    legendContainer.innerHTML = legendHTML;
    legendContainer.style.display = 'block';
}

// Generate network diagrams
function generateNetworks() {
    const section = getCurrentSection('network');
    if (!section) {
        alert('Please select a section first.');
        return;
    }

    const sectionStudentData = sectionData[section] || {};
    if (Object.keys(sectionStudentData).length === 0) {
        alert(`No student data available for Section ${section}. Please collect data from students first.`);
        return;
    }

    generateCloseTiesNetwork(section);
    generateWishTiesNetwork(section);
    
    // Display community legends and overlap after a short delay to ensure data is calculated
    setTimeout(() => {
        const anonymize = createAnonymizationMap(section);
        
        if (window.closeTiesCommunities && window.closeTiesStudents) {
            displayCommunityLegend(
                window.closeTiesCommunities,
                window.closeTiesStudents,
                'closeTiesLegend',
                anonymize
            );
        }
        
        if (window.wishTiesCommunities && window.wishTiesStudents) {
            displayCommunityLegend(
                window.wishTiesCommunities,
                window.wishTiesStudents,
                'wishTiesLegend',
                anonymize
            );
        }
        
        // Display network overlap
        displayNetworkOverlap();
    }, 1000);
}

// Calculate and display overlap between close ties and wish ties networks
function displayNetworkOverlap() {
    const overlapBox = document.getElementById('networkOverlapBox');
    if (!overlapBox) return;
    
    const closeTiesEdges = window.closeTiesEdges || new Set();
    const wishTiesEdges = window.wishTiesEdges || new Set();
    
    console.log('Calculating overlap - Close ties edges:', closeTiesEdges.size, 'Wish ties edges:', wishTiesEdges.size);
    
    if (closeTiesEdges.size === 0 && wishTiesEdges.size === 0) {
        overlapBox.style.display = 'none';
        return;
    }
    
    // Calculate overlap (edges that appear in both networks)
    const overlappingEdges = new Set();
    closeTiesEdges.forEach(edge => {
        if (wishTiesEdges.has(edge)) {
            overlappingEdges.add(edge);
        }
    });
    
    const closeTiesCount = closeTiesEdges.size;
    const wishTiesCount = wishTiesEdges.size;
    const overlapCount = overlappingEdges.size;
    
    // Calculate percentages
    const overlapPercentClose = closeTiesCount > 0 ? ((overlapCount / closeTiesCount) * 100).toFixed(1) : 0;
    const overlapPercentWish = wishTiesCount > 0 ? ((overlapCount / wishTiesCount) * 100).toFixed(1) : 0;
    
    // Calculate Jaccard similarity (intersection / union)
    const union = new Set([...closeTiesEdges, ...wishTiesEdges]);
    const jaccardSimilarity = union.size > 0 ? ((overlapCount / union.size) * 100).toFixed(1) : 0;
    
    // Generate HTML
    let html = '<h4>📊 Network Overlap Analysis</h4>';
    html += '<p style="margin-bottom: 15px; color: #666; font-size: 0.95em;">Comparing connections in the Close Ties network (friendships) and Wish Ties network (wish grants)</p>';
    html += '<div class="network-overlap-stats">';
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Close Ties Connections</div>
            <div class="overlap-stat-value">${closeTiesCount}</div>
            <div class="overlap-stat-description">Total friendship connections</div>
        </div>
    `;
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Wish Ties Connections</div>
            <div class="overlap-stat-value">${wishTiesCount}</div>
            <div class="overlap-stat-description">Total wish grant connections</div>
        </div>
    `;
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Overlapping Connections</div>
            <div class="overlap-stat-value">${overlapCount}</div>
            <div class="overlap-stat-description">Connections in both networks</div>
        </div>
    `;
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Overlap % (of Close Ties)</div>
            <div class="overlap-stat-value">${overlapPercentClose}%</div>
            <div class="overlap-stat-description">${overlapCount} of ${closeTiesCount} friendships also grant wishes</div>
        </div>
    `;
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Overlap % (of Wish Ties)</div>
            <div class="overlap-stat-value">${overlapPercentWish}%</div>
            <div class="overlap-stat-description">${overlapCount} of ${wishTiesCount} wish grants are between friends</div>
        </div>
    `;
    
    html += `
        <div class="overlap-stat-item">
            <div class="overlap-stat-label">Jaccard Similarity</div>
            <div class="overlap-stat-value">${jaccardSimilarity}%</div>
            <div class="overlap-stat-description">Overall network similarity</div>
        </div>
    `;
    
    html += '</div>';
    
    overlapBox.innerHTML = html;
    overlapBox.style.display = 'block';
}

// Calculate node degrees (number of connections)
function calculateNodeDegrees(section, isDirected = false) {
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    const degrees = {};
    
    // Only initialize degrees for students who have submitted data
    const studentsWithData = Object.keys(sectionStudentData).filter(name => 
        sectionStudentData[name] && 
        sectionStudentData[name].closeTies && 
        sectionStudentData[name].closeTies.length > 0
    );
    
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        degrees[nodeId] = 0;
    });
    
    // Count connections only between students who have submitted data
    Object.keys(sectionStudentData).forEach(name => {
        const data = sectionStudentData[name];
        if (data.closeTies && studentsWithData.includes(name)) {
            const fromId = anonymize[name];
            data.closeTies.forEach(tie => {
                // Only count if the tie target has also submitted data
                if (studentsWithData.includes(tie)) {
                    const toId = anonymize[tie];
                    if (degrees[fromId] !== undefined) degrees[fromId] = (degrees[fromId] || 0) + 1;
                    if (degrees[toId] !== undefined) degrees[toId] = (degrees[toId] || 0) + 1;
                }
            });
        }
    });
    
    return degrees;
}

// Calculate node degrees for wish network (directed - in-degree and out-degree)
function calculateWishNodeDegrees(section) {
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    const inDegrees = {}; // How many grants received
    const outDegrees = {}; // How many grants given
    
    // Only initialize degrees for students who have submitted wishes
    const studentsWithWishes = Object.keys(sectionStudentData).filter(name => 
        sectionStudentData[name] && 
        sectionStudentData[name].wish && 
        sectionStudentData[name].wish.trim() !== ''
    );
    
    studentsWithWishes.forEach(name => {
        const nodeId = anonymize[name];
        inDegrees[nodeId] = 0;
        outDegrees[nodeId] = 0;
    });
    
    // Count grants only between students who have submitted wishes
    Object.keys(sectionStudentData).forEach(name => {
        const data = sectionStudentData[name];
        if (data.wishGrants) {
            const fromId = anonymize[name];
            if (inDegrees[fromId] !== undefined) {
                // Count only grants to students who have submitted wishes
                const validGrants = data.wishGrants.filter(grantee => studentsWithWishes.includes(grantee));
                outDegrees[fromId] = validGrants.length;
                
                validGrants.forEach(grantee => {
                    const toId = anonymize[grantee];
                    if (inDegrees[toId] !== undefined) {
                        inDegrees[toId] = (inDegrees[toId] || 0) + 1;
                    }
                });
            }
        }
    });
    
    return { inDegrees, outDegrees };
}

// Color palette for communities
const communityColors = [
    { background: '#FFB6C1', border: '#FF69B4' }, // Pink
    { background: '#90EE90', border: '#32CD32' }, // Light green
    { background: '#87CEEB', border: '#4682B4' }, // Light blue
    { background: '#FFA500', border: '#FF8C00' }, // Orange
    { background: '#228B22', border: '#006400' }, // Dark green
    { background: '#DDA0DD', border: '#9370DB' }, // Plum
    { background: '#F0E68C', border: '#DAA520' }, // Khaki
    { background: '#FF6347', border: '#DC143C' }, // Tomato
    { background: '#20B2AA', border: '#008B8B' }, // Light sea green
    { background: '#FFD700', border: '#FFA500' }  // Gold
];

// Get color for a community
function getCommunityColor(communityId) {
    const colorIndex = communityId % communityColors.length;
    return communityColors[colorIndex];
}

// Calculate betweenness centrality for nodes
function calculateBetweennessCentrality(section, isDirected = false) {
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    
    // Get list of students who have submitted data
    let studentsWithData = [];
    if (isDirected) {
        studentsWithData = Object.keys(sectionStudentData).filter(name => 
            sectionStudentData[name] && 
            sectionStudentData[name].wish && 
            sectionStudentData[name].wish.trim() !== ''
        );
    } else {
        studentsWithData = Object.keys(sectionStudentData).filter(name => 
            sectionStudentData[name] && 
            sectionStudentData[name].closeTies && 
            sectionStudentData[name].closeTies.length > 0
        );
    }
    
    if (studentsWithData.length === 0) return {};
    
    const nodeIds = studentsWithData.map(name => anonymize[name]);
    const betweenness = {};
    nodeIds.forEach(id => betweenness[id] = 0);
    
    // Build adjacency list (undirected for path finding)
    const adjacency = {};
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        adjacency[nodeId] = new Set();
    });
    
    // Add edges
    Object.keys(sectionStudentData).forEach(name => {
        if (!studentsWithData.includes(name)) return;
        const data = sectionStudentData[name];
        const fromId = anonymize[name];
        
        if (isDirected && data.wishGrants) {
            data.wishGrants.forEach(grantee => {
                if (studentsWithData.includes(grantee)) {
                    const toId = anonymize[grantee];
                    if (adjacency[fromId] && adjacency[toId]) {
                        adjacency[fromId].add(toId);
                        adjacency[toId].add(fromId); // Make undirected for path finding
                    }
                }
            });
        } else if (!isDirected && data.closeTies) {
            data.closeTies.forEach(tie => {
                if (studentsWithData.includes(tie)) {
                    const toId = anonymize[tie];
                    if (adjacency[fromId] && adjacency[toId]) {
                        adjacency[fromId].add(toId);
                        adjacency[toId].add(fromId);
                    }
                }
            });
        }
    });
    
    // Calculate betweenness using Brandes algorithm
    nodeIds.forEach(source => {
        // BFS to find shortest paths and count paths
        const queue = [source];
        const distances = {};
        const pathCounts = {};
        const predecessors = {};
        
        nodeIds.forEach(id => {
            distances[id] = Infinity;
            pathCounts[id] = 0;
            predecessors[id] = [];
        });
        
        distances[source] = 0;
        pathCounts[source] = 1;
        
        // BFS phase
        while (queue.length > 0) {
            const current = queue.shift();
            
            if (adjacency[current]) {
                adjacency[current].forEach(neighbor => {
                    if (distances[neighbor] === Infinity) {
                        distances[neighbor] = distances[current] + 1;
                        queue.push(neighbor);
                    }
                    if (distances[neighbor] === distances[current] + 1) {
                        pathCounts[neighbor] += pathCounts[current];
                        predecessors[neighbor].push(current);
                    }
                });
            }
        }
        
        // Accumulation phase (Brandes algorithm)
        const dependencies = {};
        nodeIds.forEach(id => dependencies[id] = 0);
        
        // Process nodes in order of decreasing distance from source
        const sortedNodes = [...nodeIds].filter(id => distances[id] !== Infinity)
            .sort((a, b) => distances[b] - distances[a]);
        
        sortedNodes.forEach(node => {
            if (node !== source) {
                predecessors[node].forEach(predecessor => {
                    const ratio = pathCounts[predecessor] / pathCounts[node];
                    dependencies[predecessor] += ratio * (1 + dependencies[node]);
                });
                // Add to betweenness (excluding source and target endpoints)
                betweenness[node] += dependencies[node];
            }
        });
    });
    
    return betweenness;
}

// Modularity-based community detection (Louvain algorithm - simplified)
function detectCommunitiesModularity(section, isDirected = false) {
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    
    // Get list of students who have submitted data
    let studentsWithData = [];
    if (isDirected) {
        studentsWithData = Object.keys(sectionStudentData).filter(name => 
            sectionStudentData[name] && 
            sectionStudentData[name].wish && 
            sectionStudentData[name].wish.trim() !== ''
        );
    } else {
        studentsWithData = Object.keys(sectionStudentData).filter(name => 
            sectionStudentData[name] && 
            sectionStudentData[name].closeTies && 
            sectionStudentData[name].closeTies.length > 0
        );
    }
    
    if (studentsWithData.length === 0) return {};
    
    // Build adjacency matrix and calculate total edges
    const adjacency = {};
    let totalEdges = 0;
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        adjacency[nodeId] = new Set();
    });
    
    Object.keys(sectionStudentData).forEach(name => {
        if (!studentsWithData.includes(name)) return;
        const data = sectionStudentData[name];
        const fromId = anonymize[name];
        
        if (isDirected && data.wishGrants) {
            data.wishGrants.forEach(grantee => {
                if (studentsWithData.includes(grantee)) {
                    const toId = anonymize[grantee];
                    if (adjacency[fromId] && adjacency[toId]) {
                        adjacency[fromId].add(toId);
                        adjacency[toId].add(fromId);
                        totalEdges++;
                    }
                }
            });
        } else if (!isDirected && data.closeTies) {
            data.closeTies.forEach(tie => {
                if (studentsWithData.includes(tie)) {
                    const toId = anonymize[tie];
                    if (adjacency[fromId] && adjacency[toId]) {
                        if (!adjacency[toId].has(fromId)) {
                            adjacency[fromId].add(toId);
                            adjacency[toId].add(fromId);
                            totalEdges++;
                        }
                    }
                }
            });
        }
    });
    
    // Calculate degrees
    const degrees = {};
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        degrees[nodeId] = adjacency[nodeId] ? adjacency[nodeId].size : 0;
    });
    
    // Initialize communities (each node in its own community)
    const communities = {};
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        communities[nodeId] = nodeId;
    });
    
    // Louvain algorithm (simplified - multiple passes)
    let improved = true;
    let iterations = 0;
    const maxIterations = 20;
    
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        
        const nodeIds = studentsWithData.map(name => anonymize[name]).sort(() => Math.random() - 0.5);
        
        nodeIds.forEach(nodeId => {
            if (degrees[nodeId] === 0) return;
            
            const currentCommunity = communities[nodeId];
            let bestCommunity = currentCommunity;
            let bestModularityGain = 0;
            
            // Try moving to each neighbor's community
            const neighborCommunities = new Set();
            if (adjacency[nodeId]) {
                adjacency[nodeId].forEach(neighbor => {
                    neighborCommunities.add(communities[neighbor]);
                });
            }
            neighborCommunities.add(currentCommunity);
            
            neighborCommunities.forEach(testCommunity => {
                // Calculate modularity gain
                let gain = 0;
                const ki = degrees[nodeId];
                const kiIn = testCommunity === currentCommunity ? 
                    (adjacency[nodeId] ? Array.from(adjacency[nodeId]).filter(n => communities[n] === testCommunity).length : 0) :
                    (adjacency[nodeId] ? Array.from(adjacency[nodeId]).filter(n => communities[n] === testCommunity).length : 0);
                
                const sumTot = studentsWithData.reduce((sum, name) => {
                    const id = anonymize[name];
                    return sum + (communities[id] === testCommunity ? degrees[id] : 0);
                }, 0);
                
                if (totalEdges > 0) {
                    const deltaQ = (kiIn / totalEdges) - (ki * sumTot) / (2 * totalEdges * totalEdges);
                    gain = deltaQ;
                }
                
                if (gain > bestModularityGain) {
                    bestModularityGain = gain;
                    bestCommunity = testCommunity;
                }
            });
            
            if (bestCommunity !== currentCommunity && bestModularityGain > 0) {
                communities[nodeId] = bestCommunity;
                improved = true;
            }
        });
    }
    
    // Normalize community IDs to sequential numbers
    const uniqueCommunities = [...new Set(Object.values(communities))];
    const communityMap = {};
    uniqueCommunities.forEach((commId, index) => {
        communityMap[commId] = index;
    });
    
    const normalizedCommunities = {};
    Object.keys(communities).forEach(nodeId => {
        normalizedCommunities[nodeId] = communityMap[communities[nodeId]];
    });
    
    return normalizedCommunities;
}

// Calculate node size based on betweenness centrality
// Higher betweenness = bigger node (more central/brokerage role)
function getNodeSizeByBetweenness(betweenness, minBetweenness, maxBetweenness) {
    const minSize = 10;   // Minimum size for nodes with lowest betweenness
    const maxSize = 60;   // Maximum size for nodes with highest betweenness
    if (maxBetweenness === minBetweenness) {
        console.warn('All nodes have the same betweenness value:', maxBetweenness);
        return (minSize + maxSize) / 2;
    }
    const normalized = (betweenness - minBetweenness) / (maxBetweenness - minBetweenness);
    const size = minSize + (normalized * (maxSize - minSize));
    const finalSize = Math.max(minSize, Math.min(maxSize, size)); // Ensure within bounds
    return Number(finalSize.toFixed(2)); // Ensure it's a number
}

// Generate close ties network
function generateCloseTiesNetwork(section) {
    const nodes = [];
    const edges = [];
    const sectionStudentsList = sectionStudents[section] || [];
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    
    // Get list of students who have submitted data (have closeTies)
    const studentsWithData = Object.keys(sectionStudentData).filter(name => 
        sectionStudentData[name] && 
        sectionStudentData[name].closeTies && 
        sectionStudentData[name].closeTies.length > 0
    );

    if (studentsWithData.length === 0) {
        const container = document.getElementById('closeTiesNetwork');
        if (container) {
            container.innerHTML = '<p style="padding: 20px; color: #666;">No network data available. Please ensure students have submitted their data.</p>';
        }
        return;
    }

    // Calculate betweenness centrality for sizing
    const betweenness = calculateBetweennessCentrality(section, false);
    const betweennessValues = Object.values(betweenness).filter(v => v !== undefined && !isNaN(v));
    const maxBetweenness = betweennessValues.length > 0 ? Math.max(...betweennessValues) : 0;
    const minBetweenness = betweennessValues.length > 0 ? Math.min(...betweennessValues) : 0;
    
    // Calculate degrees as fallback
    const degrees = calculateNodeDegrees(section);
    const degreeValues = Object.values(degrees).filter(v => v !== undefined);
    const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 1;
    const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;
    
    // Debug: log betweenness values
    console.log('=== Close Ties Network ===');
    console.log('Betweenness values:', betweenness);
    console.log('Min betweenness:', minBetweenness, 'Max betweenness:', maxBetweenness);
    console.log('Degree values:', degrees);
    console.log('Min degree:', minDegree, 'Max degree:', maxDegree);
    
    // Use betweenness if there's variation, otherwise fall back to degree
    const useBetweenness = (maxBetweenness - minBetweenness) > 0.001;
    console.log('Using betweenness for sizing:', useBetweenness);
    
    // Detect communities using modularity for coloring
    const communities = detectCommunitiesModularity(section, false);
    
    // Store communities for legend display
    window.closeTiesCommunities = communities;
    window.closeTiesStudents = studentsWithData;

    // Create nodes only for students who have submitted data
    studentsWithData.forEach(name => {
        const nodeId = anonymize[name];
        const betweennessValue = betweenness[nodeId] || 0;
        const degree = degrees[nodeId] || 0;
        const communityId = communities[nodeId] || 0;
        const color = getCommunityColor(communityId);
        
        // Use betweenness if available and varies, otherwise use degree
        let size;
        if (useBetweenness) {
            size = getNodeSizeByBetweenness(betweennessValue, minBetweenness, maxBetweenness);
        } else {
            // Fallback to degree-based sizing
            const normalized = maxDegree > minDegree ? (degree - minDegree) / (maxDegree - minDegree) : 0.5;
            size = 10 + (normalized * (60 - 10));
            console.warn(`Using degree for node ${nodeId} (${name}): degree=${degree}, size=${size.toFixed(1)}`);
        }
        
        // Debug: log first few nodes
        if (studentsWithData.indexOf(name) < 5) {
            console.log(`Node ${nodeId} (${name}): betweenness=${betweennessValue.toFixed(4)}, degree=${degree}, size=${size.toFixed(1)}`);
        }
        
        nodes.push({
            id: nodeId,
            label: '', // No labels on nodes
            color: color.background || color, // Use background color from community color object
            border: color.border || color.background || color, // Use border color
            shape: 'circle',
            size: Number(size), // Size based on betweenness centrality (bigger = more central)
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5, x: 2, y: 2 },
            chosen: false // Don't apply any automatic styling
        });
    });

    // Create edges for close ties (bidirectional, using numeric IDs)
    // Only create edges between students who have submitted data
    Object.keys(sectionStudentData).forEach(name => {
        const data = sectionStudentData[name];
        if (data.closeTies && studentsWithData.includes(name)) {
            const fromId = anonymize[name];
            data.closeTies.forEach(tie => {
                // Only create edge if the tie target has also submitted data
                if (studentsWithData.includes(tie)) {
                    const toId = anonymize[tie];
                    // Only add edge if it doesn't already exist (avoid duplicates)
                    const edgeExists = edges.some(e => 
                        (e.from === fromId && e.to === toId) || 
                        (e.from === toId && e.to === fromId)
                    );
                    if (!edgeExists) {
                        // Color edges based on node colors (match community colors)
                        const fromCommunity = communities[fromId] || 0;
                        const toCommunity = communities[toId] || 0;
                        let edgeColor = '#cccccc';
                        if (fromCommunity === toCommunity) {
                            // Same community - use community color
                            const commColor = getCommunityColor(fromCommunity);
                            edgeColor = commColor.border || commColor.background;
                        }
                        
                        edges.push({
                            from: fromId,
                            to: toId,
                            color: { color: edgeColor, highlight: '#667eea', opacity: 0.4 },
                            width: 1.5,
                            smooth: { type: 'continuous', roundness: 0.5 }
                        });
                    }
                }
            });
        }
    });

    // Store edges for overlap calculation (normalize to undirected pairs)
    // Do this AFTER edges are created
    const closeTiesEdges = new Set();
    edges.forEach(edge => {
        const pair = [edge.from, edge.to].sort().join('-');
        closeTiesEdges.add(pair);
    });
    window.closeTiesEdges = closeTiesEdges;
    console.log('Stored close ties edges:', closeTiesEdges.size, 'edges');

    const data = { nodes: nodes, edges: edges };
    const options = {
        nodes: {
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5, x: 2, y: 2 },
            font: { size: 0 }, // Ensure no labels are shown
            fixed: {
                x: false,
                y: false
            },
        },
        edges: {
            shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 3 },
            arrows: {
                to: { enabled: false }
            },
            smooth: { type: 'continuous', roundness: 0.5 }
        },
        physics: {
            enabled: true,
            stabilization: { 
                iterations: 500,
                fit: true,
                updateInterval: 25
            },
            barnesHut: {
                gravitationalConstant: -5000,  // Stronger repulsion (pushes unconnected nodes apart)
                centralGravity: 0.05,          // Reduced central gravity for better clustering
                springLength: 80,             // Shorter ideal distance (pulls connected nodes closer)
                springConstant: 0.15,          // Stronger spring force (stronger attraction between connected nodes)
                damping: 0.15,                // Higher damping for smoother, more stable movement
                avoidOverlap: 0,               // Don't adjust sizes for overlap (preserve our size differences)
                theta: 0.5                     // Barnes-Hut approximation parameter
            }
        },
        layout: {
            improvedLayout: false  // Disable automatic layout improvements that might affect sizing
        },
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true,
            hover: true,
            tooltipDelay: 200
        }
    };

    const container = document.getElementById('closeTiesNetwork');
    if (container) {
        // Create DataSet for nodes to allow updates
        const nodesDataSet = new vis.DataSet(nodes);
        const edgesDataSet = new vis.DataSet(edges);
        const networkData = { nodes: nodesDataSet, edges: edgesDataSet };
        
        // Log initial sizes before creating network
        console.log('=== Creating Close Ties Network ===');
        console.log('Initial node sizes:', nodes.slice(0, 5).map(n => `Node ${n.id}: size=${n.size}`));
        console.log('Size range:', Math.min(...nodes.map(n => n.size)), 'to', Math.max(...nodes.map(n => n.size)));
        
        const network = new vis.Network(container, networkData, options);
        
        // Force update sizes function
        const updateSizes = function(source) {
            console.log(`Updating sizes (triggered by: ${source})`);
            const updates = nodes.map(node => ({
                id: node.id,
                size: node.size
            }));
            nodesDataSet.update(updates);
            console.log(`Updated ${updates.length} node sizes`);
            console.log('Sample sizes after update:', updates.slice(0, 5).map(u => `Node ${u.id}: ${u.size}`));
            // Force redraw
            network.redraw();
        };
        
        // Update immediately after a short delay
        setTimeout(() => updateSizes('initial timeout'), 200);
        
        // Update after network is ready
        network.once('initRedraw', () => {
            console.log('Network initRedraw event fired');
            setTimeout(() => updateSizes('initRedraw'), 100);
        });
        
        // Update after stabilization starts
        network.once('startStabilizing', () => {
            console.log('Network startStabilizing event fired');
        });
        
        // Update after physics stabilization
        network.once('stabilizationEnd', function() {
            console.log('Stabilization ended - updating sizes');
            updateSizes('stabilizationEnd');
            
            // Check actual rendered sizes in DOM
            setTimeout(() => {
                const canvas = container.querySelector('canvas');
                if (canvas) {
                    console.log('=== Checking actual rendered node sizes ===');
                    const positions = network.getPositions();
                    const nodeIds = Object.keys(positions);
                    
                    // Get node data from DataSet
                    nodeIds.slice(0, 10).forEach(nodeId => {
                        const nodeData = nodesDataSet.get(nodeId);
                        const position = positions[nodeId];
                        console.log(`Node ${nodeId}: data.size=${nodeData?.size}, position=(${position?.x?.toFixed(1)}, ${position?.y?.toFixed(1)})`);
                    });
                    
                    // Try to get actual rendered size from network
                    try {
                        const nodeOptions = network.getOptions().nodes;
                        console.log('Node options:', nodeOptions);
                        console.log('Scaling config:', nodeOptions.scaling);
                    } catch(e) {
                        console.log('Could not get node options:', e);
                    }
                }
            }, 500);
        });
        
        // Also listen for any stabilization progress
        network.on('stabilizationProgress', function(params) {
            if (params.iterations === 1) {
                console.log('Stabilization started');
            }
            if (params.iterations % 100 === 0) {
                console.log(`Stabilization progress: ${params.iterations} iterations`);
            }
        });
    }
}

// Generate wish ties network
function generateWishTiesNetwork(section) {
    const nodes = [];
    const edges = [];
    const sectionStudentsList = sectionStudents[section] || [];
    const sectionStudentData = sectionData[section] || {};
    const anonymize = createAnonymizationMap(section);
    
    // Get list of students who have submitted wishes
    const studentsWithWishes = Object.keys(sectionStudentData).filter(name => 
        sectionStudentData[name] && 
        sectionStudentData[name].wish && 
        sectionStudentData[name].wish.trim() !== ''
    );

    if (studentsWithWishes.length === 0) {
        const container = document.getElementById('wishTiesNetwork');
        if (container) {
            container.innerHTML = '<p style="padding: 20px; color: #666;">No network data available. Please ensure students have submitted their data.</p>';
        }
        return;
    }

    // Calculate betweenness centrality for sizing
    const betweenness = calculateBetweennessCentrality(section, true);
    const betweennessValues = Object.values(betweenness).filter(v => v !== undefined && !isNaN(v));
    const maxBetweenness = betweennessValues.length > 0 ? Math.max(...betweennessValues) : 0;
    const minBetweenness = betweennessValues.length > 0 ? Math.min(...betweennessValues) : 0;
    
    // Calculate degrees as fallback
    const { inDegrees, outDegrees } = calculateWishNodeDegrees(section);
    const totalDegrees = {};
    studentsWithWishes.forEach(name => {
        const nodeId = anonymize[name];
        totalDegrees[nodeId] = (inDegrees[nodeId] || 0) + (outDegrees[nodeId] || 0);
    });
    const degreeValues = Object.values(totalDegrees).filter(v => v !== undefined);
    const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 1;
    const minDegree = degreeValues.length > 0 ? Math.min(...degreeValues) : 0;
    
    // Debug: log betweenness values
    console.log('=== Wish Ties Network ===');
    console.log('Betweenness values:', betweenness);
    console.log('Min betweenness:', minBetweenness, 'Max betweenness:', maxBetweenness);
    console.log('Degree values:', totalDegrees);
    console.log('Min degree:', minDegree, 'Max degree:', maxDegree);
    
    // Use betweenness if there's variation, otherwise fall back to degree
    const useBetweenness = (maxBetweenness - minBetweenness) > 0.001;
    console.log('Using betweenness for sizing:', useBetweenness);
    
    // Detect communities using modularity for coloring
    const communities = detectCommunitiesModularity(section, true);
    
    // Store communities for legend display
    window.wishTiesCommunities = communities;
    window.wishTiesStudents = studentsWithWishes;

    // Create nodes only for students who have submitted wishes
    studentsWithWishes.forEach(name => {
        const nodeId = anonymize[name];
        const betweennessValue = betweenness[nodeId] || 0;
        const degree = totalDegrees[nodeId] || 0;
        const communityId = communities[nodeId] || 0;
        const color = getCommunityColor(communityId);
        
        // Use betweenness if available and varies, otherwise use degree
        let size;
        if (useBetweenness) {
            size = getNodeSizeByBetweenness(betweennessValue, minBetweenness, maxBetweenness);
        } else {
            // Fallback to degree-based sizing
            const normalized = maxDegree > minDegree ? (degree - minDegree) / (maxDegree - minDegree) : 0.5;
            size = 10 + (normalized * (60 - 10));
            console.warn(`Using degree for node ${nodeId} (${name}): degree=${degree}, size=${size.toFixed(1)}`);
        }
        
        // Debug: log first few nodes
        if (studentsWithWishes.indexOf(name) < 5) {
            console.log(`Wish Node ${nodeId} (${name}): betweenness=${betweennessValue.toFixed(4)}, degree=${degree}, size=${size.toFixed(1)}`);
        }
        
        nodes.push({
            id: nodeId,
            label: '', // No labels on nodes
            color: color.background || color, // Use background color from community color object
            border: color.border || color.background || color, // Use border color
            shape: 'circle',
            size: Number(size), // Size based on betweenness centrality (bigger = more central)
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5, x: 2, y: 2 },
            chosen: false // Don't apply any automatic styling
        });
    });

    // Create edges for wish grants (directed: from granter to wish-maker, using numeric IDs)
    // Only create edges if both granter and grantee have submitted data
    Object.keys(sectionStudentData).forEach(name => {
        const data = sectionStudentData[name];
        if (data.wishGrants) {
            const fromId = anonymize[name];
            data.wishGrants.forEach(grantee => {
                // Only create edge if grantee has submitted a wish
                if (studentsWithWishes.includes(grantee)) {
                    const toId = anonymize[grantee];
                    
                    // Color edges based on node colors (match community colors)
                    const fromCommunity = communities[fromId] || 0;
                    const toCommunity = communities[toId] || 0;
                    let edgeColor = '#cccccc';
                    if (fromCommunity === toCommunity) {
                        // Same community - use community color
                        const commColor = getCommunityColor(fromCommunity);
                        edgeColor = commColor.border || commColor.background;
                    }
                    
                    edges.push({
                        from: fromId,
                        to: toId,
                        color: { color: edgeColor, highlight: '#667eea', opacity: 0.4 },
                        width: 2,
                        arrows: {
                            to: { enabled: false }
                        },
                        smooth: { type: 'continuous', roundness: 0.5 }
                    });
                }
            });
        }
    });

    // Store edges for overlap calculation (normalize to undirected pairs for comparison)
    // Do this AFTER edges are created
    const wishTiesEdges = new Set();
    edges.forEach(edge => {
        // Treat as undirected for comparison (A->B same as B->A)
        const pair = [edge.from, edge.to].sort().join('-');
        wishTiesEdges.add(pair);
    });
    window.wishTiesEdges = wishTiesEdges;
    console.log('Stored wish ties edges:', wishTiesEdges.size, 'edges');

    const data = { nodes: nodes, edges: edges };
    const options = {
        nodes: {
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5, x: 2, y: 2 },
            font: { size: 0 }, // Ensure no labels are shown
            fixed: {
                x: false,
                y: false
            },
        },
        edges: {
            shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 3 },
            smooth: { type: 'continuous', roundness: 0.5 }
        },
        physics: {
            enabled: true,
            stabilization: { 
                iterations: 500,
                fit: true,
                updateInterval: 25
            },
            barnesHut: {
                gravitationalConstant: -5000,  // Stronger repulsion (pushes unconnected nodes apart)
                centralGravity: 0.05,          // Reduced central gravity for better clustering
                springLength: 80,             // Shorter ideal distance (pulls connected nodes closer)
                springConstant: 0.15,          // Stronger spring force (stronger attraction between connected nodes)
                damping: 0.15,                // Higher damping for smoother, more stable movement
                avoidOverlap: 0,               // Don't adjust sizes for overlap (preserve our size differences)
                theta: 0.5                     // Barnes-Hut approximation parameter
            }
        },
        layout: {
            improvedLayout: false  // Disable automatic layout improvements that might affect sizing
        },
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true,
            hover: true,
            tooltipDelay: 200
        }
    };

    const container = document.getElementById('wishTiesNetwork');
    if (container) {
        try {
            // Clear any existing network
            container.innerHTML = '';
            // Create DataSet for nodes to allow updates
            const nodesDataSet = new vis.DataSet(nodes);
            const edgesDataSet = new vis.DataSet(edges);
            const networkData = { nodes: nodesDataSet, edges: edgesDataSet };
            
            // Log initial sizes before creating network
            console.log('=== Creating Wish Ties Network ===');
            console.log('Initial node sizes:', nodes.slice(0, 5).map(n => `Node ${n.id}: size=${n.size}`));
            console.log('Size range:', Math.min(...nodes.map(n => n.size)), 'to', Math.max(...nodes.map(n => n.size)));
            
            const network = new vis.Network(container, networkData, options);
            
            // Force update sizes function
            const updateSizes = function(source) {
                console.log(`Updating wish network sizes (triggered by: ${source})`);
                const updates = nodes.map(node => ({
                    id: node.id,
                    size: node.size
                }));
                nodesDataSet.update(updates);
                console.log(`Updated ${updates.length} wish network node sizes`);
                console.log('Sample sizes after update:', updates.slice(0, 5).map(u => `Node ${u.id}: ${u.size}`));
                // Force redraw
                network.redraw();
            };
            
            // Update immediately after a short delay
            setTimeout(() => updateSizes('initial timeout'), 200);
            
            // Update after network is ready
            network.once('initRedraw', () => {
                console.log('Wish network initRedraw event fired');
                setTimeout(() => updateSizes('initRedraw'), 100);
            });
            
            // Update after stabilization starts
            network.once('startStabilizing', () => {
                console.log('Wish network startStabilizing event fired');
            });
            
            // Update after physics stabilization
            network.once('stabilizationEnd', function() {
                console.log('Wish network stabilization ended - updating sizes');
                updateSizes('stabilizationEnd');
            });
            
            // Also listen for any stabilization progress
            network.on('stabilizationProgress', function(params) {
                if (params.iterations === 1) {
                    console.log('Wish network stabilization started');
                }
                if (params.iterations % 100 === 0) {
                    console.log(`Wish network stabilization progress: ${params.iterations} iterations`);
                }
            });
        } catch (error) {
            console.error('Error generating wish ties network:', error);
            container.innerHTML = '<p style="padding: 20px; color: #666;">Error generating network. Please check the browser console for details.</p>';
        }
    } else {
        console.error('Wish ties network container not found');
    }
}

// Download networks as images
function downloadNetworks() {
    alert('To save the network diagrams as images:\n\n1. Right-click on each network diagram\n2. Select "Save image as..." or use your browser\'s screenshot tool\n\nAlternatively, you can use browser extensions or take screenshots of the entire page.');
}

// Export data
function exportData() {
    const data = {
        sectionStudents: sectionStudents,
        sectionData: sectionData,
        exportDate: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wish-network-data.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Import data
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                // Support both old and new format
                if (data.sectionStudents) {
                    sectionStudents = data.sectionStudents;
                } else if (data.students) {
                    // Old format - convert to new format (assume Section A)
                    sectionStudents['A'] = data.students;
                }
                if (data.sectionData) {
                    sectionData = data.sectionData;
                } else if (data.studentData) {
                    // Old format - convert to new format (assume Section A)
                    sectionData['A'] = data.studentData;
                }
                // Initialize missing sections
                ['A', 'B', 'C', 'D'].forEach(section => {
                    if (!sectionStudents[section]) {
                        sectionStudents[section] = [];
                    }
                    if (!sectionData[section]) {
                        sectionData[section] = {};
                    }
                });
                saveData();
                updateUI();
                showMessage('grantMessage', 'Data imported successfully!', 'success');
            } catch (error) {
                showMessage('grantMessage', 'Error importing data: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Clear survey data for selected section (keeps student names)
async function clearSurveyData() {
    const section = getCurrentSection('setup');
    if (!section) {
        showMessage('setupMessage', 'Please select a section first.', 'error');
        return;
    }

    if (confirm(`Are you sure you want to clear all survey data (wishes and wish grants) for Section ${section}? Student names will be kept. This cannot be undone.`)) {
        // Clear all survey data for this section
        sectionData[section] = {};
        
        // Save to both localStorage and Firebase
        await saveData();
        
        // Also explicitly clear Firebase data for this section if Firebase is enabled
        if (window.firebaseEnabled && window.firestore) {
            try {
                const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const { doc, setDoc } = firestoreModule;
                
                // Update the sectionData document in Firebase with the cleared section
                // We need to reload the full sectionData first, then update just this section
                const dataDoc = doc(window.firestore, 'data', 'sectionData');
                const { getDoc } = firestoreModule;
                const currentDoc = await getDoc(dataDoc);
                
                if (currentDoc.exists()) {
                    const currentData = currentDoc.data();
                    if (currentData.data) {
                        // Update just this section in the data
                        currentData.data[section] = {};
                        await setDoc(dataDoc, {
                            data: currentData.data,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`Cleared Firebase data for Section ${section}`);
                    }
                } else {
                    // Document doesn't exist yet, create it with empty section
                    await setDoc(dataDoc, {
                        data: sectionData,
                        updatedAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('Error clearing Firebase data:', error);
                // Still show success message since localStorage was cleared
            }
        }
        
        updateUI();
        showMessage('setupMessage', `Survey data cleared for Section ${section}. Student names have been preserved.`, 'success');
    }
}

// Clear all data
function clearAllData() {
    if (confirm('Are you sure you want to clear all student data for all sections? This cannot be undone.')) {
        sectionData = {};
        ['A', 'B', 'C', 'D'].forEach(section => {
            sectionData[section] = {};
        });
        saveData();
        showMessage('grantMessage', 'All data has been cleared.', 'success');
    }
}

// Show message
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = `<div class="alert alert-${type === 'success' ? 'success' : 'info'}">${message}</div>`;
    setTimeout(() => {
        element.innerHTML = '';
    }, 5000);
}

// Save to Firebase (if enabled) and localStorage (as fallback)
async function saveData() {
    // Always save to localStorage as fallback
    localStorage.setItem('wishNetworkSectionStudents', JSON.stringify(sectionStudents));
    localStorage.setItem('wishNetworkSectionData', JSON.stringify(sectionData));
    
    // Also save to Firebase if enabled
    // Wait a bit to ensure Firebase is initialized
    if (window.firebaseEnabled) {
        // Wait for Firebase to be ready (max 2 seconds)
        let attempts = 0;
        while (!window.firestore && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.firestore) {
            const saved = await saveToFirebase();
            if (!saved) {
                console.warn('Failed to save to Firebase, but data saved to localStorage');
            }
        } else {
            console.warn('Firestore not ready after waiting, saving to localStorage only');
        }
    }
}

// Load from Firebase (if enabled), localStorage, and students.json file
async function loadData() {
    // Initialize sections
    ['A', 'B', 'C', 'D'].forEach(section => {
        if (!sectionStudents[section]) {
            sectionStudents[section] = [];
        }
        if (!sectionData[section]) {
            sectionData[section] = {};
        }
    });
    
    // Try to load from Firebase first (if enabled)
    const firebaseLoaded = await loadFromFirebase();
    
    // If Firebase loaded successfully, it will have set up real-time listeners
    // and populated sectionStudents and sectionData
    // We still want to merge with students.json and localStorage as fallback
    
    // Load student names from students.json file (for GitHub deployment)
    try {
        const response = await fetch('students.json');
        if (response.ok) {
            const fileData = await response.json();
            // Merge file data with existing data (file data is the base, Firebase/localStorage can override)
            Object.keys(fileData).forEach(section => {
                if (fileData[section] && fileData[section].length > 0) {
                    // Only use file data if we don't have data for this section yet
                    if (!sectionStudents[section] || sectionStudents[section].length === 0) {
                        sectionStudents[section] = fileData[section];
                    }
                }
            });
        }
    } catch (error) {
        console.log('Could not load students.json file (this is OK if running locally):', error);
    }

    // Load from localStorage (as fallback if Firebase not enabled, or for initial load)
    if (!firebaseLoaded) {
        const savedSectionStudents = localStorage.getItem('wishNetworkSectionStudents');
        const savedSectionData = localStorage.getItem('wishNetworkSectionData');

        // Load from localStorage (takes precedence over file for student names)
        if (savedSectionStudents) {
            const parsed = JSON.parse(savedSectionStudents);
            Object.keys(parsed).forEach(section => {
                // Only override if localStorage has data (instructor may have updated via app)
                if (parsed[section] && parsed[section].length > 0) {
                    sectionStudents[section] = parsed[section];
                }
            });
        }

        if (savedSectionData) {
            const parsed = JSON.parse(savedSectionData);
            Object.keys(parsed).forEach(section => {
                sectionData[section] = parsed[section];
            });
        }

        // Support old format for backward compatibility
        const savedStudents = localStorage.getItem('wishNetworkStudents');
        const savedData = localStorage.getItem('wishNetworkData');
        if (savedStudents && !savedSectionStudents) {
            // Convert old format to new (assume Section A)
            sectionStudents['A'] = JSON.parse(savedStudents);
            const studentNamesInput = document.getElementById('studentNames');
            if (studentNamesInput) {
                studentNamesInput.value = sectionStudents['A'].join('\n');
            }
        }
        if (savedData && !savedSectionData) {
            // Convert old format to new (assume Section A)
            sectionData['A'] = JSON.parse(savedData);
        }
    }
}

// Event listeners for student name selection
document.addEventListener('DOMContentLoaded', function() {
    const studentNameWish = document.getElementById('studentNameWish');
    if (studentNameWish) {
        studentNameWish.addEventListener('change', function() {
            // Clear form when name is selected - don't load existing data
            // Students should only see their own data when they submit
            const wishInput = document.getElementById('wishInput');
            if (wishInput) wishInput.value = '';
            document.querySelectorAll('#closeTies input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateCloseTiesCount();
        });
    }

    const studentNameGrant = document.getElementById('studentNameGrant');
    if (studentNameGrant) {
        studentNameGrant.addEventListener('change', function() {
            // Update the grant tab to show wishes (excluding self)
            selectedWishIds = []; // Reset selection
            updateGrantTab();
        });
    }
});