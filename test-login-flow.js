const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001';

async function testLoginFlow() {
    console.log('=== Testing Login and Newgame Flow ===');
    
    // Test data
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        apiKey: 'sk-test-key-12345',
        provider: 'openai'
    };
    
    try {
        // Step 1: Register a user
        console.log('\n1. Registering user...');
        const registerResponse = await fetch(`${API_URL}/api/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        
        const registerData = await registerResponse.json();
        console.log('Register response:', registerData);
        
        if (!registerResponse.ok) {
            throw new Error(`Registration failed: ${registerData.error}`);
        }
        
        const { userId, token } = registerData;
        
        // Step 2: Login with API key
        console.log('\n2. Logging in with API key...');
        const loginResponse = await fetch(`${API_URL}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                apiKey: testUser.apiKey,
                provider: testUser.provider
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginData.error}`);
        }
        
        const newToken = loginData.token;
        
        // Step 3: Try to create a new game
        console.log('\n3. Creating new game...');
        const newgameResponse = await fetch(`${API_URL}/api/game/newgame`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`
            },
            body: JSON.stringify({
                mode: 'single-room'
            })
        });
        
        const newgameData = await newgameResponse.json();
        console.log('Newgame response:', newgameData);
        
        if (newgameResponse.ok) {
            console.log('\n✅ SUCCESS: Login and newgame flow works correctly!');
        } else {
            console.log('\n❌ FAILED: Newgame failed:', newgameData.error);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

// Run the test
testLoginFlow(); 