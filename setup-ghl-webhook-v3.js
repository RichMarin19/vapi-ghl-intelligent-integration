#!/usr/bin/env node

// Script to automatically configure GHL webhook for VAPI integration using PIT tokens
import axios from 'axios';
import { PITTokenManager } from './pit-token-manager.js';

const LAMBDA_URL = 'https://7jahamtx2g2pkure4ew4nty7ua0xyykl.lambda-url.us-east-2.on.aws/';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// PIT Token Manager (no OAuth needed)
const pitTokenManager = new PITTokenManager();

// Removed getParameter function - PIT token manager handles token retrieval

// Removed getLocationIdFromToken function - using hardcoded location ID with PIT tokens

async function createWebhook(pitToken, locationId) {
    // Try different webhook endpoints and event formats
    const webhookConfigs = [
        {
            endpoint: '/locations/webhooks',
            payload: {
                url: LAMBDA_URL,
                events: ['contact.created', 'contact.updated', 'contact.tag.added']
            }
        },
        {
            endpoint: '/hooks',
            payload: {
                url: LAMBDA_URL,
                events: ['ContactCreate', 'ContactUpdate', 'ContactTagUpdate'],
                locationId: locationId
            }
        },
        {
            endpoint: `/locations/${locationId}/webhooks`,
            payload: {
                url: LAMBDA_URL,
                events: ['contact.created', 'contact.updated', 'contact.tag.added']
            }
        }
    ];
    
    for (const config of webhookConfigs) {
        try {
            console.log(`\n🔄 Trying endpoint: ${config.endpoint}`);
            console.log('Payload:', JSON.stringify(config.payload, null, 2));
            
            const response = await axios.post(`${GHL_BASE_URL}${config.endpoint}`, config.payload, {
                headers: {
                    'Authorization': `Bearer ${pitToken}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('✅ Webhook created successfully!');
            console.log('Webhook details:', JSON.stringify(response.data, null, 2));
            return response.data;
            
        } catch (error) {
            console.log(`❌ Failed with ${config.endpoint}:`, error.response?.status, error.response?.statusText);
            if (error.response?.data) {
                console.log('Error details:', error.response.data);
            }
            continue; // Try next endpoint
        }
    }
    
    console.log('\n🔍 All webhook creation attempts failed. Checking existing webhooks...');
    return await checkExistingWebhooks(pitToken, locationId);
}

async function checkExistingWebhooks(pitToken, locationId) {
    const checkEndpoints = [
        '/hooks',
        '/locations/webhooks',
        `/locations/${locationId}/webhooks`
    ];
    
    for (const endpoint of checkEndpoints) {
        try {
            console.log(`\n🔍 Checking existing webhooks at: ${endpoint}`);
            
            const params = endpoint === '/hooks' ? { locationId: locationId } : {};
            const response = await axios.get(`${GHL_BASE_URL}${endpoint}`, {
                params: params,
                headers: {
                    'Authorization': `Bearer ${pitToken}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json'
                }
            });
            
            const webhooks = response.data.webhooks || response.data.hooks || response.data;
            console.log(`Found ${webhooks.length || 0} existing webhook(s)`);
            
            if (webhooks && webhooks.length > 0) {
                webhooks.forEach((hook, index) => {
                    console.log(`\nWebhook ${index + 1}:`);
                    console.log(`  URL: ${hook.url || hook.webhookUrl}`);
                    console.log(`  Events: ${hook.events ? hook.events.join(', ') : 'N/A'}`);
                    console.log(`  ID: ${hook.id}`);
                });
                
                // Look for webhook with our Lambda URL
                const existingWebhook = webhooks.find(hook => 
                    (hook.url && hook.url === LAMBDA_URL) || 
                    (hook.webhookUrl && hook.webhookUrl === LAMBDA_URL) ||
                    (hook.url && hook.url.includes('lambda-url')) ||
                    (hook.webhookUrl && hook.webhookUrl.includes('lambda-url'))
                );
                
                if (existingWebhook) {
                    console.log('\n✅ Found existing webhook for Lambda URL');
                    return existingWebhook;
                }
            }
            
        } catch (error) {
            console.log(`❌ Failed to check ${endpoint}:`, error.response?.status, error.response?.statusText);
            continue;
        }
    }
    
    return null;
}

async function main() {
    console.log('🚀 Setting up GHL webhook for VAPI integration...');
    console.log('Lambda URL:', LAMBDA_URL);
    console.log('');
    
    try {
        // Get PIT token (much simpler than OAuth)
        console.log('📝 Getting PIT token...');
        await pitTokenManager.getValidToken();
        
        if (!pitTokenManager.pitToken) {
            console.error('❌ Could not get valid PIT token');
            console.log('Make sure your PIT token is properly configured');
            process.exit(1);
        }
        
        console.log('✅ PIT token ready');
        
        // Use hardcoded location ID (simpler than parsing from token)
        const locationId = 'Tty8tmfsIBN4DdOVzgVa'; // Your GHL location ID
        console.log('📍 Using location ID:', locationId);
        
        // Create or find webhook
        console.log('🔗 Setting up webhook...');
        const webhook = await createWebhook(pitTokenManager.pitToken, locationId);
        
        if (webhook) {
            console.log('\n🎉 Setup complete!');
            console.log('\n✅ Your GHL webhook is configured');
            console.log('💡 Test it by tagging a contact with "fsbo" in GHL');
            console.log('🔍 Check Lambda logs to see the webhook events');
            console.log('\n📋 MANUAL SETUP INSTRUCTIONS (if auto-setup didn\'t work):');
            console.log('1. Go to GHL Settings → Integrations → Webhooks');
            console.log('2. Create new webhook with:');
            console.log(`   URL: ${LAMBDA_URL}`);
            console.log('   Events: contact.created, contact.updated, contact.tag.added');
            console.log('   Method: POST');
        } else {
            console.log('\n❌ Could not create webhook automatically');
            console.log('\n📋 MANUAL SETUP REQUIRED:');
            console.log('1. Go to GHL Settings → Integrations → Webhooks');
            console.log('2. Create new webhook with:');
            console.log(`   URL: ${LAMBDA_URL}`);
            console.log('   Events: contact.created, contact.updated, contact.tag.added');
            console.log('   Method: POST');
            console.log('\n✅ Your Lambda is ready to receive webhooks once configured in GHL');
        }
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n📋 MANUAL SETUP REQUIRED:');
        console.log('1. Go to GHL Settings → Integrations → Webhooks');
        console.log('2. Create new webhook with:');
        console.log(`   URL: ${LAMBDA_URL}`);
        console.log('   Events: contact.created, contact.updated, contact.tag.added');
        console.log('   Method: POST');
    }
}

main();