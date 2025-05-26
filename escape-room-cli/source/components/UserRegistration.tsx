import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getApiUrl } from '../utils/apiConfig.js';
// import SelectInput from 'ink-select-input';

interface UserRegistrationProps {
  onRegistrationComplete: (userData: { 
    name: string; 
    email?: string; // Optional
    userId?: string; 
    token?: string; 
    apiKey?: string; // Optional
    apiKeyProvider?: 'anthropic' | 'openai'; // Optional
  }) => void;
  username?: string;
  email?: string;
}

const USER_CONFIG_FILE = path.join(os.homedir(), '.escape-room-config.json');

interface UserConfig {
  name: string;
  email?: string;
  userId?: string; 
  registeredAt: string;
  apiKeys?: { anthropic?: string; openai?: string; };
}

export async function handleLogin(userId: string, apiKey?: string, provider?: 'openai' | 'anthropic') {
  const apiUrl = getApiUrl();
  const loginPayload: any = { userId };
  if (apiKey && provider) {
    loginPayload.apiKey = apiKey;
    loginPayload.provider = provider;
  }
  console.log('=== CLI: Sending login request ===');
  console.log('UserId:', userId);
  console.log('API Key provided:', !!apiKey);
  console.log('Provider:', provider);
  console.log('Login payload:', loginPayload);
  
  const loginResponse = await fetch(`${apiUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginPayload)
  });
  return loginResponse as any;
}

const UserRegistration: React.FC<UserRegistrationProps> = ({ 
  onRegistrationComplete, 
  username = '', 
  email = '' 
}) => {
  const [step, setStep] = useState<'name' | 'email' | 'apiKey' | 'loading' | 'verifying' | 'complete'>('verifying');
  const [name, setName] = useState<string>(username);
  const [userEmail, setUserEmail] = useState<string>(email); // Can be empty string
  const [currentApiKeyProvider, setCurrentApiKeyProvider] = useState<'anthropic' | 'openai'>('openai');
  const [currentCliApiKey, setCurrentCliApiKey] = useState<string>(''); // Can be empty string
  const [message, setMessage] = useState<string>('Checking for existing configuration...');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const attemptAutoLoginAndLoadConfig = async () => {
      setMessage('Checking for existing user session...');
      setStep('verifying');
      let proceedToManualReg = true;

      let initialName = username; // Start with prop
      let initialEmail = email;   // Start with prop

      try {
        if (fs.existsSync(USER_CONFIG_FILE)) {
          const configRaw = fs.readFileSync(USER_CONFIG_FILE, 'utf8');
          const loadedConfig = JSON.parse(configRaw) as UserConfig;

          initialName = loadedConfig.name || initialName; // Config overrides prop if present
          initialEmail = loadedConfig.email || initialEmail;
          setName(initialName);
          setUserEmail(initialEmail || '');

          const configApiKeyOpenAI = loadedConfig.apiKeys?.openai;
          const configApiKeyAnthropic = loadedConfig.apiKeys?.anthropic;
          let loginApiKey: string | undefined;
          let loginProvider: 'openai' | 'anthropic' = 'openai';
          
          if (configApiKeyOpenAI) {
            setCurrentCliApiKey(configApiKeyOpenAI);
            setCurrentApiKeyProvider('openai');
            loginApiKey = configApiKeyOpenAI;
            loginProvider = 'openai';
          } else if (configApiKeyAnthropic) {
            setCurrentCliApiKey(configApiKeyAnthropic);
            setCurrentApiKeyProvider('anthropic');
            loginApiKey = configApiKeyAnthropic;
            loginProvider = 'anthropic';
          }

          //LOGIN INSTEAD OF REGISTER --------------------------------------------------------------------------------------------------
          if (loadedConfig.userId && initialName) { // Ensure name is also present
            // Pass API key and provider to login if available
            const loginResponse = await handleLogin(
              loadedConfig.userId, 
              loginApiKey, 
              loginProvider
            );
            const loginData = await loginResponse.json() as any; //FIXME: as { token: string; error?: string };

            if (loginResponse.ok && loginData.token) {
              setMessage('Welcome back! Session restored.');
              setStep('complete');
              const sessionApiKey = loginApiKey || process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
              const sessionProvider = loginApiKey ? loginProvider : (process.env['OPENAI_API_KEY'] ? 'openai' : 'anthropic');
              
              onRegistrationComplete({ 
                name: initialName, 
                email: initialEmail || undefined,
                userId: loadedConfig.userId, 
                token: loginData.token,
                apiKey: sessionApiKey,
                apiKeyProvider: sessionProvider
              });
              proceedToManualReg = false; 
            } else {
              setMessage(`Login attempt failed: ${loginData.error || 'Could not restore session.'}. Please verify details or register.`);
            }
          }
          // ------------------------------------------------------------------------------------------------------------------------------
        }
      } catch (error) {
        setMessage('Could not load config or login. Please register.');
      }
      

      // FALLBACK TO MANUAL REGISTRATION --------------------------------------------------------------------------------------------------
      if (proceedToManualReg) {
        if (!currentCliApiKey) { // If no API key from config, check ENV
            const openaiEnvKey = process.env['OPENAI_API_KEY'];
            const anthropicEnvKey = process.env['ANTHROPIC_API_KEY'];
            if (openaiEnvKey) {
                setCurrentCliApiKey(openaiEnvKey);
                setCurrentApiKeyProvider('openai');
            } else if (anthropicEnvKey) {
                setCurrentCliApiKey(anthropicEnvKey);
                setCurrentApiKeyProvider('anthropic');
            }
        }
        
        // Determine initial step for manual registration based on effectively available name/email
        let manualInitialStep: 'name' | 'email' | 'apiKey' = 'name';
        if (initialName) {
            manualInitialStep = 'email';
            if (initialEmail) {
                manualInitialStep = 'apiKey';
            }
        }
        // Ensure CLI args override for initial step if provided directly
        if (username) { // If username prop was passed
            setName(username);
            manualInitialStep = 'email';
            if (email) { // If email prop was also passed
                setUserEmail(email);
                manualInitialStep = 'apiKey';
            }
        }

        setStep(manualInitialStep);
        setMessage(manualInitialStep === 'name' && !initialName ? 'Please register to continue.' : 'Please verify your details.');
      }
    };
    attemptAutoLoginAndLoadConfig();
  }, []);

  const saveUserConfig = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('loading');
    setMessage('Registering and saving configuration...');

    const finalRegApiKey = currentCliApiKey || undefined;
    const finalRegProvider = currentApiKeyProvider;

    const registrationPayload: any = { name, provider: finalRegProvider };
    if (userEmail) registrationPayload.email = userEmail;
    if (finalRegApiKey) registrationPayload.apiKey = finalRegApiKey;

    let receivedUserId: string | undefined;
    let receivedToken: string | undefined;

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationPayload)
      });
      const data = await response.json() as any; //FIXME: as { userId: string; token: string; error?: string };
      if (response.ok && data.userId && data.token) {
        receivedUserId = data.userId;
        receivedToken = data.token;
        setMessage('Registered with backend server!');
        try {
            const configToSave: UserConfig = {
                name,
                userId: receivedUserId,
                registeredAt: new Date().toISOString(),
                apiKeys: finalRegApiKey && finalRegProvider ? { [finalRegProvider]: finalRegApiKey } : undefined
            };
            if (userEmail) configToSave.email = userEmail;
            else delete configToSave.email; // Ensure email field is not present if empty

            fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(configToSave, null, 2));
            setMessage('Configuration saved! Registration complete.');
            setStep('complete');
            onRegistrationComplete({ 
                name, 
                email: userEmail || undefined, 
                userId: receivedUserId, 
                token: receivedToken, 
                apiKey: finalRegApiKey,
                apiKeyProvider: finalRegProvider 
            });
        } catch (saveError) {
            setMessage('Registered, but error saving config locally.');
            setStep('complete'); 
            onRegistrationComplete({ 
                name, 
                email: userEmail || undefined,
                userId: receivedUserId, 
                token: receivedToken, 
                apiKey: finalRegApiKey, 
                apiKeyProvider: finalRegProvider 
            });
        }
      } else {
        setMessage(`Backend registration failed: ${data.error || 'Unknown error'}.`);
        setStep('apiKey');
        setIsSubmitting(false);
      }
    } catch (networkError) {
      setMessage('Network error. Could not register.');
      setStep('apiKey');
      setIsSubmitting(false);
    }
  };
  
  if (step === 'verifying' || step === 'loading') {
    return (
        <Box padding={1}><Text color="yellow"><Spinner type="dots" /> {message}</Text></Box>
    );
  }

  if (step === 'name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">What's your name?</Text>
        <TextInput value={name} onChange={setName} onSubmit={() => setStep('email')} placeholder="Your Name"/>
        <Text color="gray">Press Enter</Text>
      </Box>
    );
  }

  if (step === 'email') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Your email (optional):</Text>
        <TextInput value={userEmail} onChange={setUserEmail} onSubmit={() => setStep('apiKey')} placeholder="your.email@example.com"/>
        <Text color="gray">Press Enter</Text>
      </Box>
    );
  }

  if (step === 'apiKey') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Your AI API Key (OpenAI or Anthropic):</Text>
        <Box marginTop={1} flexDirection="row" alignItems="center">
            <Text color="cyan">Current AI Provider: </Text>
            <Text> [{currentApiKeyProvider.toUpperCase()}] </Text>
        </Box>
        <Box>
          <Text color="cyan">API Key: </Text>
          <TextInput
            value={currentCliApiKey}
            onChange={setCurrentCliApiKey}
            onSubmit={saveUserConfig}
            placeholder="sk-... or anthropic-key-..."
            mask="*"
            
          />
        </Box>
        <Box marginTop={1}>
          {currentCliApiKey && <Text color="gray">Your key will be registered & stored locally in {USER_CONFIG_FILE}</Text>}
        </Box>
        <Box marginTop={1}>
          <Text color="cyan">Press Enter to register and save.</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'complete') {
    return (
        <Box padding={1}><Text color="green">✓ {message || 'Ready! Starting game...'}</Text></Box>
    );
  }
  return <Text>Loading registration...</Text>; 
};

export default UserRegistration; 