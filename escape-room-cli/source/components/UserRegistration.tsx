import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getApiUrl } from '../utils/apiConfig.js';
interface UserRegistrationProps {
  onRegistrationComplete: (userData: { name: string; email?: string; apiKey?: string; userId?: string }) => void;
  username?: string;
  email?: string;
}

const USER_CONFIG_FILE = path.join(os.homedir(), '.escape-room-config.json');

interface UserConfig {
  name: string;
  email?: string;
  registeredAt: string;
  userId?: string; // Add userId from backend
  apiKeys?: {
    anthropic?: string;
    openai?: string;
  };
}

const UserRegistration: React.FC<UserRegistrationProps> = ({ 
  onRegistrationComplete, 
  username = '', 
  email = '' 
}) => {
  const [step, setStep] = useState<'name' | 'email' | 'apiKey' | 'loading' | 'complete'>('name');
  const [name, setName] = useState<string>(username);
  const [userEmail, setUserEmail] = useState<string>(email);
  const [apiKeyProvider, setApiKeyProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    let initialStep: 'name' | 'email' | 'apiKey' = 'name';
    let skipRegistration = false;
    let loadedConfig: UserConfig | null = null;

    // Check if config file exists and load data
    try {
      if (fs.existsSync(USER_CONFIG_FILE)) {
        console.log("UserRegistration: Config file found. Loading data...");
        const configRaw = fs.readFileSync(USER_CONFIG_FILE, 'utf8');
        loadedConfig = JSON.parse(configRaw) as UserConfig;
        
        if (loadedConfig.userId && loadedConfig.name) {
            // If userId and name exist, we might skip registration
            // We should verify this userId with the backend
            console.log(`UserRegistration: Found existing userId: ${loadedConfig.userId} and name: ${loadedConfig.name}`);
            // For now, assume if userId exists, we can proceed. Verification step can be added later.
            // Pre-fill state for onRegistrationComplete call
            setName(loadedConfig.name);
            if (loadedConfig.email) setUserEmail(loadedConfig.email);
            
            // Try to get API key from config or env
            let existingApiKey = loadedConfig.apiKeys?.anthropic || loadedConfig.apiKeys?.openai;
            let existingProvider = loadedConfig.apiKeys?.anthropic ? 'anthropic' : 'openai';

            if (!existingApiKey) { // If not in config, check ENV
                if (anthropicKey) {
                    existingApiKey = anthropicKey;
                    existingProvider = 'anthropic';
                } else if (openaiKey) {
                    existingApiKey = openaiKey;
                    existingProvider = 'openai';
                }
            }
            if (existingApiKey) setApiKey(existingApiKey);
            // Set flag to skip form steps
            skipRegistration = true;
        } else {
            // Config exists but no userId or name, proceed with normal registration pre-filling
            if (loadedConfig.name) setName(loadedConfig.name);
            if (loadedConfig.email) setUserEmail(loadedConfig.email);
            initialStep = loadedConfig.name ? (loadedConfig.email ? 'apiKey' : 'email') : 'name';
        }
      }
    } catch (error) {
      console.error('Error loading config during init:', error);
      // Proceed without pre-filled data, normal registration flow
    }

    if (skipRegistration && loadedConfig?.userId && loadedConfig?.name) {
        console.log("UserRegistration: Skipping registration form, userId found in config.");
        setMessage('Existing user found. Welcome back!');
        setStep('complete'); // Go directly to complete
        // Call onRegistrationComplete with loaded data
        // Ensure apiKey state is set correctly before this call if we rely on it in onRegistrationComplete
        const finalApiKeyFromConfig = apiKey || loadedConfig.apiKeys?.anthropic || loadedConfig.apiKeys?.openai || anthropicKey || openaiKey;
        // const finalProviderFromConfig = (apiKey && apiKeyProvider) ? apiKeyProvider : (loadedConfig.apiKeys?.anthropic ? 'anthropic' : (loadedConfig.apiKeys?.openai ? 'openai' : (anthropicKey ? 'anthropic' : 'openai')));

        onRegistrationComplete({
            name: loadedConfig.name,
            email: loadedConfig.email,
            userId: loadedConfig.userId,
            apiKey: finalApiKeyFromConfig
            // provider is implicitly handled by apiKey state or chosen if multiple exist
        });
        return; // Exit useEffect early
    }
    
    //---------------------------------------------------------------------
    // If not skipping, 
    // set up API keys from ENV if present (for new registration flow)
    //---------------------------------------------------------------------
    if (anthropicKey && !apiKey) { // only if not already set by config load for skip path
        setApiKeyProvider('anthropic');
        setApiKey(anthropicKey);
        console.log("UserRegistration (new reg): Found Anthropic key in ENV.");
    } else if (openaiKey && !apiKey) { // only if not already set
        setApiKeyProvider('openai');
        setApiKey(openaiKey);
        console.log("UserRegistration (new reg): Found OpenAI key in ENV.");
    }
    
    //---------------------------------------------------------------------
    //                Adjust CLI args if provided
    // overriding config-based initialStep for new registration
    //---------------------------------------------------------------------
    if (username) {
        setName(username);
        initialStep = 'email';
        if (email) {
             setUserEmail(email);
             initialStep = 'apiKey';
        }
    }
    console.log(`UserRegistration: Setting initial step for new/partial registration to: ${initialStep}`);
    setStep(initialStep);

  }, []); // Run only once on mount

  const saveUserConfig = async () => {
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);

    setStep('loading');
    setMessage('Attempting registration and saving configuration...');
    console.log("UserRegistration: saveUserConfig called.");

    // Re-check env vars just before saving, in case they were set after app start
    const currentAnthropicKey = process.env['ANTHROPIC_API_KEY'];
    const currentOpenAIKey = process.env['OPENAI_API_KEY'];
    let finalApiKey = apiKey; // Use state apiKey by default
    let finalProvider = apiKeyProvider;

    // Override with env vars if state apiKey is empty
    if (!finalApiKey) {
        if (currentAnthropicKey) {
            finalApiKey = currentAnthropicKey;
            finalProvider = 'anthropic';
            console.log("UserRegistration: Using Anthropic key from ENV.");
        } else if (currentOpenAIKey) {
            finalApiKey = currentOpenAIKey;
            finalProvider = 'openai';
            console.log("UserRegistration: Using OpenAI key from ENV.");
        }
    }
    
    // Log the data being sent
    const registrationData = {
        name,
        email: userEmail,
        apiKey: finalApiKey, // Use potentially updated key
        provider: finalProvider
    };
    console.log("UserRegistration: Preparing to register with backend. Data:", registrationData);

    let userId: string | undefined;
    try {
      console.log("UserRegistration: Attempting fetch to /api/users/register...");
      const apiUrl = getApiUrl(); // Get base URL
      const response = await fetch(`${apiUrl}/api/users/register`, { // Use template literal
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });
      
      console.log("UserRegistration: Fetch response status:", response.status);
      const data = await response.json();
      console.log("UserRegistration: Backend response data:", data);
      
      if (response.ok && data.userId) {
        userId = data.userId;
        setMessage('Registered with backend server!');
      } else {
          // Log backend error if registration failed but request went through
          console.error("UserRegistration: Backend registration failed:", data.error || 'Unknown backend error');
          setMessage(`Backend registration failed: ${data.error || 'Unknown error'}. Saving locally.`);
      }

    } catch (networkError) {
      // Catch network errors specifically
      console.error('UserRegistration: Network error connecting to backend:', networkError);
      setMessage('Could not connect to backend server. Saving locally only.');
    }
    
    // Save locally regardless of backend success
    try {
        console.log("UserRegistration: Saving config file locally...");
        const config: UserConfig = {
            name,
            registeredAt: new Date().toISOString(),
            apiKeys: {},
            userId
        };
        if (userEmail) config.email = userEmail;
        if (finalApiKey) config.apiKeys = { [finalProvider]: finalApiKey };
        
        fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log("UserRegistration: Config file saved.");

        setMessage('Configuration saved!');
        setStep('complete');
        
        // Call completion callback *after* saving
        console.log("UserRegistration: Calling onRegistrationComplete...");
        onRegistrationComplete({ 
            name, 
            email: userEmail,
            apiKey: finalApiKey, // Pass the key actually used
            userId
        });

    } catch (saveError) {
        console.error('UserRegistration: Error saving config file:', saveError);
        setMessage('Error saving configuration file locally. Please check permissions.');
        setStep('apiKey'); // Go back if local save failed
        setIsSubmitting(false);
    }
  };

  // Render based on current step
  if (step === 'name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>What's your name?</Text>
        <Box marginTop={1}>
          <TextInput
            value={name}
            onChange={setName}
            onSubmit={() => setStep('email')}
          />
        </Box>
        <Text color="gray">Press Enter to continue</Text>
      </Box>
    );
  }

  if (step === 'email') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Your email (optional):</Text>
        <Box marginTop={1}>
          <TextInput
            value={userEmail}
            onChange={setUserEmail}
            onSubmit={() => setStep('apiKey')}
          />
        </Box>
        <Text color="gray">Press Enter to continue</Text>
      </Box>
    );
  }

  if (step === 'apiKey') {
    // Check if we found an environment API key during useEffect
    const hasEnvKey = !!(process.env['ANTHROPIC_API_KEY'] || process.env['OPENAI_API_KEY']);
    const providerName = process.env['ANTHROPIC_API_KEY'] ? 'Anthropic' : (process.env['OPENAI_API_KEY'] ? 'OpenAI' : '');

    if (hasEnvKey) {
      //---------------------------------------------------------------------
      // FOUND KEY IN ENV: 
      // Show confirmation message and trigger save on Enter
      //---------------------------------------------------------------------
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>API Key Found in Environment!</Text>
          <Text>{providerName} API Key detected.</Text>
          <Box marginTop={1}>
            <Text color="green">✓ </Text>
            <Text>Press Enter to confirm and complete registration.</Text>
          </Box>
          {/* Hidden input to capture the final submit action */}
          <Box height={0} width={0} overflow="hidden">
              <TextInput value="" onChange={() => {}} onSubmit={saveUserConfig}/>
          </Box>
        </Box>
      );
    } else {
      //---------------------------------------------------------------------
      // NO KEY FOUND IN ENV: 
      // Instruct user to set it and allow proceeding
      //---------------------------------------------------------------------
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Set up your AI API Key:</Text>
          <Text>No API key found in environment variables (ANTHROPIC_API_KEY or OPENAI_API_KEY).</Text>
          <Text>Please set one in your environment:</Text>
          <Box marginTop={1} marginLeft={2}><Text>export OPENAI_API_KEY="your-key-here"</Text></Box>
          <Text>or</Text>
          <Box marginLeft={2}><Text>export ANTHROPIC_API_KEY="your-key-here"</Text></Box>
          <Box marginTop={1}><Text>Then restart the application.</Text></Box>
          <Box marginTop={2}><Text color="yellow">Alternatively, press Enter to continue without an API key (AI features will be limited).</Text></Box>
          {/* Hidden input to capture the submit action */}
          <Box height={0} width={0} overflow="hidden">
             <TextInput value="" onChange={() => {}} onSubmit={saveUserConfig}/>
          </Box>
        </Box>
      );
    }
  }

  if (step === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> {message}</Text>
        </Box>
      </Box>
    );
  }

  // This step is reached either by auto-completion in useEffect OR after saveUserConfig
  if (step === 'complete') {
    return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Text color="green">✓ </Text>
            <Text color="green">{message || 'Registration complete! Starting... '}</Text>
          </Box>
        </Box>
      );
  }

  // Default fallback or handle unexpected step value
  return <Text>Loading registration...</Text>; 
};

export default UserRegistration; 