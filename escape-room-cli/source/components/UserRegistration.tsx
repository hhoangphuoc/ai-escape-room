import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface UserRegistrationProps {
  onRegistrationComplete: (userData: { name: string; email?: string; apiKey?: string }) => void;
  username?: string;
  email?: string;
}

const USER_CONFIG_FILE = path.join(os.homedir(), '.escape-room-config.json');

interface UserConfig {
  name: string;
  email?: string;
  registeredAt: string;
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

  // Load API keys from environment variables
  useEffect(() => {
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];

    // Check if config file exists and load data
    try {
      if (fs.existsSync(USER_CONFIG_FILE)) {
        const configData = JSON.parse(fs.readFileSync(USER_CONFIG_FILE, 'utf8')) as UserConfig;
        
        // If we already have registration data and at least one API key, complete registration
        if (configData.name && (
            (configData.apiKeys?.anthropic && configData.apiKeys.anthropic.length > 0) || 
            (configData.apiKeys?.openai && configData.apiKeys.openai.length > 0)
          )) {
          setName(configData.name);
          setUserEmail(configData.email || '');
          
          // Determine which API key to use
          if (configData.apiKeys?.anthropic) {
            setApiKeyProvider('anthropic');
            setApiKey(configData.apiKeys.anthropic);
          } else if (configData.apiKeys?.openai) {
            setApiKeyProvider('openai');
            setApiKey(configData.apiKeys.openai);
          }
          
          // Skip to completion
          setStep('complete');
          onRegistrationComplete({ 
            name: configData.name, 
            email: configData.email,
            apiKey: configData.apiKeys?.anthropic || configData.apiKeys?.openai
          });
          return;
        } else if (configData.name) {
          // If we have name but no API key, start at API key step
          setName(configData.name);
          setUserEmail(configData.email || '');
          setStep('apiKey');
          return;
        }
      }
      
      // If we have environment API keys, use them
      if (anthropicKey) {
        setApiKeyProvider('anthropic');
        setApiKey(anthropicKey);
      } else if (openaiKey) {
        setApiKeyProvider('openai');
        setApiKey(openaiKey);
      }
      
      // If username was provided via CLI, start at email step
      if (username) {
        setStep('email');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }, [username, email, onRegistrationComplete]);


  const saveUserConfig = async () => {
    setStep('loading');
    setMessage('Saving your information...');
    
    try {
      // Create config object
      const config: UserConfig = {
        name,
        registeredAt: new Date().toISOString(),
        apiKeys: {}
      };
      
      if (userEmail) {
        config.email = userEmail;
      }
      
      if (apiKey) {
        config.apiKeys = {
          [apiKeyProvider]: apiKey
        };
      }
      
      // Write to config file
      fs.writeFileSync(USER_CONFIG_FILE, JSON.stringify(config, null, 2));
      
      setMessage('Registration complete!');
      setStep('complete');
      
      // Pass data to parent component
      onRegistrationComplete({ 
        name, 
        email: userEmail,
        apiKey: apiKey 
      });
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage('Error saving configuration. Please try again.');
      setStep('apiKey');
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
    // Check if we have environment API keys
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    const openaiKey = process.env['OPENAI_API_KEY'];
    
    if (anthropicKey || openaiKey) {
      // If we have environment keys, show a message and complete registration
      const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
      
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>API Key Found!</Text>
          <Text>{provider} API Key detected in your environment.</Text>
          <Box marginTop={1}>
            <Text color="green">✓ </Text>
            <Text>You're all set! Click Enter to continue.</Text>
          </Box>
          <Box marginTop={2}>
            <TextInput
              value=""
              onChange={() => {}}
              onSubmit={saveUserConfig}
            />
          </Box>
        </Box>
      );
    }
    
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Set up your AI API Key:</Text>
        <Text>
          No API key found in environment variables. You'll need to add your key by:
        </Text>
        <Box marginTop={1} marginLeft={2}>
          <Text>export ANTHROPIC_API_KEY="your-key-here"</Text>
        </Box>
        <Text>or</Text>
        <Box marginLeft={2}>
          <Text>export OPENAI_API_KEY="your-key-here"</Text>
        </Box>
        <Box marginTop={2}>
          <Text>Then restart the application or continue without AI assistance.</Text>
        </Box>
        <Box marginTop={2}>
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={saveUserConfig}
            placeholder="Press Enter to continue"
          />
        </Box>
      </Box>
    );
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="green">✓ </Text>
        <Text>Registration complete! Starting the Escape Room CLI...</Text>
      </Box>
    </Box>
  );
};

export default UserRegistration; 