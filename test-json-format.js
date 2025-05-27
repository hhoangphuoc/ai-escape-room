#!/usr/bin/env node

/**
 * Test script to verify JSON format improvements
 * This script tests the API endpoints and logs the JSON responses
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testJSONFormat() {
    console.log('=== TESTING JSON FORMAT IMPROVEMENTS ===\n');
    
    try {
        // Test 1: Register a test user
        console.log('1. Testing user registration...');
        const registerResponse = await fetch(`${API_BASE}/api/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: 'test@example.com',
                openaiApiKey: 'test-key-123'
            })
        });
        
        if (!registerResponse.ok) {
            console.log('Registration failed (user might already exist), trying login...');
        }
        
        // Test 2: Login
        console.log('2. Testing user login...');
        const loginResponse = await fetch(`${API_BASE}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@example.com',
                openaiApiKey: 'test-key-123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error('Login failed');
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('✓ Login successful\n');
        
        // Test 3: Create new game (predefined room)
        console.log('3. Testing /newgame with predefined room...');
        const newGameResponse = await fetch(`${API_BASE}/api/newgame`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mode: 'single-predefined'
            })
        });
        
        if (!newGameResponse.ok) {
            throw new Error('New game creation failed');
        }
        
        const gameData = await newGameResponse.json();
        console.log('✓ New game created successfully');
        console.log('=== GAME RESPONSE JSON ===');
        console.log(JSON.stringify(gameData, null, 2));
        console.log('\n');
        
        // Test 4: Look around
        console.log('4. Testing /look command...');
        const lookResponse = await fetch(`${API_BASE}/api/game/look`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!lookResponse.ok) {
            throw new Error('Look command failed');
        }
        
        const lookData = await lookResponse.json();
        console.log('✓ Look command successful');
        console.log('=== LOOK RESPONSE JSON ===');
        console.log(JSON.stringify(lookData, null, 2));
        console.log('\n');
        
        // Test 5: Inspect an object
        console.log('5. Testing /inspect command...');
        const inspectResponse = await fetch(`${API_BASE}/api/game/inspect?object=Manual`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!inspectResponse.ok) {
            throw new Error('Inspect command failed');
        }
        
        const inspectData = await inspectResponse.json();
        console.log('✓ Inspect command successful');
        console.log('=== INSPECT RESPONSE JSON ===');
        console.log(JSON.stringify(inspectData, null, 2));
        console.log('\n');
        
        // Validate JSON structure
        console.log('6. Validating JSON structure...');
        
        if (gameData.game && gameData.game.roomData) {
            const roomData = gameData.game.roomData;
            const requiredFields = ['name', 'background', 'password', 'hint', 'escape', 'objects'];
            const missingFields = requiredFields.filter(field => !(field in roomData));
            
            if (missingFields.length === 0) {
                console.log('✓ Room data has all required fields');
            } else {
                console.log('✗ Room data missing fields:', missingFields);
            }
            
            if (Array.isArray(roomData.objects) && roomData.objects.length > 0) {
                const obj = roomData.objects[0];
                const objRequiredFields = ['name', 'description', 'puzzle', 'answer', 'lock'];
                const objMissingFields = objRequiredFields.filter(field => !(field in obj));
                
                if (objMissingFields.length === 0) {
                    console.log('✓ Object data has all required fields');
                } else {
                    console.log('✗ Object data missing fields:', objMissingFields);
                }
            }
        }
        
        console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testJSONFormat(); 