// Firebase Configuration
// 
// To enable Firebase (for real-time data sync across devices):
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Enable Firestore Database (Build > Firestore Database > Create database)
// 4. Get your config from Project Settings > General > Your apps > Web app
// 5. Replace the values below with your Firebase config
//
// If you don't configure Firebase, the app will use localStorage (data stored locally in each browser)

// IMPORTANT: This file contains sensitive credentials and should NOT be committed to GitHub
// If you're setting this up, copy firebase-config.js.example and add your own credentials
// For existing deployments, this file should be added to .gitignore

window.firebaseConfig = {
    apiKey: "AIzaSyALbwOBwIPDJrfHZR6giOe7NCwdhCtVqzU",
    authDomain: "wish-network.firebaseapp.com",
    projectId: "wish-network",
    storageBucket: "wish-network.firebasestorage.app",
    messagingSenderId: "808333561899",
    appId: "1:808333561899:web:0c63460d724ef43620da6e"
};

// If you haven't configured Firebase, the app will automatically use localStorage instead
