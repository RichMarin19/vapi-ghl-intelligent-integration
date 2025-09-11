import axios from 'axios';
import { AuthorizationCode } from 'simple-oauth2';
import jwt from 'jsonwebtoken';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';

// Import modular components
import * as NoteManager from './note-manager.js';
import { PITTokenManager } from './pit-token-manager.js';
import { processAppointmentRequest } from './appointment-manager.js';

// Environment variables
const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const VAPI_SECRET_TOKEN = process.env.VAPI_SECRET_TOKEN;
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || '9dcdb98a-613c-4927-a007-8e3437ef337c';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const VAPI_API_BASE_URL = 'https://api.vapi.ai';

// AWS SSM client for Parameter Store
const ssmClient = new SSMClient({ region: 'us-east-2' });

// Parameter Store paths
const ACCESS_TOKEN_PARAM = '/vapi-ghl-integration/ghl-access-token';
const REFRESH_TOKEN_PARAM = '/vapi-ghl-integration/ghl-refresh-token';

// OAuth2 configuration for GHL
const oauth2Config = {
    client: {
        id: GHL_CLIENT_ID,
        secret: GHL_CLIENT_SECRET
    },
    auth: {
        tokenHost: 'https://marketplace.gohighlevel.com',
        tokenPath: '/oauth/token',
        authorizePath: '/oauth/authorize'
    }
};

// Global PIT token manager instance
const pitTokenManager = new PITTokenManager();

// Function to get parameter from Parameter Store
async function getParameter(paramName, decrypt = true) {
    try {
        const command = new GetParameterCommand({
            Name: paramName,
            WithDecryption: decrypt
        });
        const response = await ssmClient.send(command);
        return response.Parameter?.Value || null;
    } catch (error) {
        console.error(`Error getting parameter ${paramName}:`, error);
        return null;
    }
}

// Function to store parameter in Parameter Store
async function putParameter(paramName, value, secure = true) {
    try {
        const command = new PutParameterCommand({
            Name: paramName,
            Value: value,
            Type: secure ? 'SecureString' : 'String',
            Overwrite: true
        });
        await ssmClient.send(command);
        console.log(`Parameter ${paramName} stored successfully`);
    } catch (error) {
        console.error(`Error storing parameter ${paramName}:`, error);
        throw error;
    }
}


// Function to get valid authentication headers using PIT Token
async function getValidAuthHeaders() {
    try {
        console.log('🔍 Getting valid auth headers using PIT Token...');
        await pitTokenManager.getValidToken();
        const headers = pitTokenManager.getAuthHeaders();
        console.log('✅ Valid PIT authentication headers obtained');
        return headers;
    } catch (error) {
        console.error('❌ Failed to get valid auth headers:', error.message);
        console.log('🔑 PIT token may be invalid or missing required scopes');
        console.log('💡 Consider running: node pit-token-manager.js status');
        throw new Error(`PIT token authentication failed: ${error.message}`);
    }
}

// Function to get contact by ID from GHL using PIT
async function getContactById(contactId) {
    try {
        console.log(`📞 Getting contact by ID: ${contactId}`);
        const response = await pitTokenManager.makeGHLRequest('GET', `/contacts/${contactId}`);
        console.log(`✅ Contact found: ${response.data.contact?.firstName} ${response.data.contact?.lastName}`);
        return response.data.contact;
    } catch (error) {
        console.error('❌ Error getting contact by ID:', error.response?.data || error.message);
        throw error;
    }
}

// Function to update contact in GHL using PIT
async function updateContact(contactId, updateData) {
    try {
        console.log(`🔄 Updating contact ${contactId} with data:`, Object.keys(updateData));
        const response = await pitTokenManager.makeGHLRequest('PUT', `/contacts/${contactId}`, updateData);
        console.log('✅ Contact updated successfully');
        return response.data;
    } catch (error) {
        console.error('❌ Error updating contact:', error.response?.data || error.message);
        throw error;
    }
}

// Function to create contact note using PIT
async function createContactNote(contactId, noteBody) {
    try {
        console.log(`📝 Creating note for contact ${contactId} (${noteBody.length} chars)`);
        const response = await pitTokenManager.makeGHLRequest('POST', `/contacts/${contactId}/notes`, {
            body: noteBody
        });
        
        console.log('✅ Note created successfully:', response.data?.note?.id || 'ID not returned');
        console.log('📄 Note API response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('❌ Error creating contact note:', error.response?.data || error.message);
        throw error;
    }
}

// Function to extract contact ID from VAPI call data
function extractContactId(call) {
    // 1. Try assistant overrides first (most reliable for test cases)
    if (call?.assistantOverrides?.variableValues?.contactId) {
        const contactId = call.assistantOverrides.variableValues.contactId;
        console.log(`Using contact ID from assistant overrides: ${contactId}`);
        return contactId;
    }
    
    // 2. Extract from artifact tool calls (real VAPI calls)
    if (call?.artifact?.messages && Array.isArray(call.artifact.messages)) {
        for (const message of call.artifact.messages) {
            if (message.role === 'tool_call_result' && message.result) {
                try {
                    const resultData = typeof message.result === 'string' 
                        ? JSON.parse(message.result) 
                        : message.result;
                    
                    if (resultData.id && message.name === 'create_contact') {
                        const contactId = resultData.id;
                        console.log(`Using contact ID from create_contact result: ${contactId}`);
                        return contactId;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
    }
    
    console.log('No contact ID found in VAPI call data');
    return null;
}

// Function to analyze transcript and extract data
function analyzeTranscript(transcriptText, structuredData) {
    console.log('Analyzing transcript with structured data:', structuredData);
    console.log('Transcript text:', transcriptText + '...');
    
    // Use structured data from VAPI analysis if available
    if (structuredData) {
        // Filter to only include valid GHL contact fields
        const validGHLFields = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'address1', 'city', 'state', 'postalCode', 'website', 'timezone', 'dnd', 'source', 'tags'];
        
        const filteredData = {};
        Object.keys(structuredData).forEach(key => {
            if (validGHLFields.includes(key)) {
                filteredData[key] = structuredData[key];
            }
        });
        
        console.log('Filtered extracted data for GHL:', filteredData);
        return filteredData;
    }
    
    // Fallback to basic extraction if no structured data
    const extractedData = {};
    
    if (transcriptText) {
        // Simple extraction patterns
        const emailMatch = transcriptText.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) extractedData.email = emailMatch[0];
        
        const phoneMatch = transcriptText.match(/\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/);
        if (phoneMatch) extractedData.phone = `+1${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
    }
    
    return extractedData;
}

// Legacy appointment function (now handled by appointment-manager.js module)

// Main Lambda handler
export async function handler(event) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        let payload;
        
        // Parse the event body
        if (typeof event.body === 'string') {
            console.log('Event body type: string');
            console.log('Event body length:', event.body.length);
            
            try {
                payload = JSON.parse(event.body);
                console.log('JSON parsing successful, payload keys:', Object.keys(payload));
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid JSON in request body' })
                };
            }
        } else {
            payload = event.body || event;
        }
        
        // Handle VAPI end-of-call reports
        if (payload.message?.type === 'end-of-call-report') {
            console.log('Processing VAPI end-of-call report...');
            
            const callData = payload.message;
            const call = callData.call;
            
            if (!call) {
                console.error('No call data found in end-of-call report');
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'No call data found' })
                };
            }
            
            // Process asynchronously if not already async
            if (!payload._asyncProcessing) {
                console.log('Triggering async processing...');
                
                // Invoke this same Lambda function asynchronously
                const lambda = new (await import('@aws-sdk/client-lambda')).LambdaClient({ 
                    region: 'us-east-2'  // Fixed region to match Lambda location
                });
                
                await lambda.send(new (await import('@aws-sdk/client-lambda')).InvokeCommand({
                    FunctionName: 'vapi-ghl-integration',
                    InvocationType: 'Event', // Async invocation
                    Payload: JSON.stringify({
                        ...event,
                        body: JSON.stringify({
                            ...payload,
                            _asyncProcessing: true
                        })
                    })
                }));
                
                return {
                    statusCode: 202,
                    body: JSON.stringify({ message: 'Processing started asynchronously' })
                };
            }
            
            // Async processing
            console.log('Processing async contact update...');
            console.log('Processing call for phone number:', call.customer?.number);
            
            // Validate call data first (prevents note creation issues)
            const validation = NoteManager.validateCallDataForNotes(callData);
            if (!validation.isValid) {
                console.log('⚠️ Call data validation failed:', validation.issues);
                console.log('ℹ️ Continuing without creating note...');
            }
            
            // Extract contact ID using enhanced modular function
            const contactId = NoteManager.extractContactIdFromCall(call);
            
            if (!contactId) {
                console.error('Could not extract contact ID from call data');
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Could not extract contact ID' })
                };
            }
            
            // Initialize PIT token manager
            await pitTokenManager.getValidToken();
            
            // Get existing contact
            const existingContact = await getContactById(contactId);
            console.log(`Found contact by ID: ${existingContact.firstName} ${existingContact.lastName} (ID: ${contactId})`);
            
            // Analyze transcript and extract data
            const transcriptText = call.transcript || 'No transcript available';
            const structuredData = call.analysis?.structuredData;
            const extractedData = analyzeTranscript(transcriptText, structuredData);
            
            // Update contact with extracted data
            if (Object.keys(extractedData).length > 0) {
                console.log('Updating contact with extracted data...');
                await updateContact(contactId, extractedData);
                console.log('Contact updated successfully');
            }
            
            // Create call summary note using modular system
            let noteResult = null;
            if (validation.isValid) {
                try {
                    console.log('📝 Creating call summary note using modular system...');
                    // Pass the complete payload structure with both message and call
                    const fullCallData = {
                        message: payload.message,
                        call: call
                    };
                    const callSummary = NoteManager.generateCallSummary(fullCallData, extractedData);
                    noteResult = await createContactNote(contactId, callSummary);
                    console.log('✅ Modular note creation completed successfully');
                } catch (noteError) {
                    console.error('❌ Modular note creation failed:', noteError.message);
                    console.log('📝 Attempting fallback note creation...');
                    
                    // Fallback to simple note if modular system fails
                    const simpleSummary = `📞 VAPI Call Summary
Call ID: ${call.id}
Duration: ${call.startedAt && call.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 60000) : 'Unknown'} minutes
Date: ${new Date().toLocaleDateString()}

🎯 Key Information Extracted:
${Object.entries(extractedData).map(([key, value]) => `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join('\n')}

📝 Full Transcript:
"${transcriptText}"

🎵 Audio Recording:
Call ID: ${call.id} (Contact VAPI support for audio access)

Generated by VAPI-GHL Integration`;
                    
                    try {
                        noteResult = await createContactNote(contactId, simpleSummary);
                        console.log('✅ Fallback note creation completed');
                    } catch (fallbackError) {
                        console.error('❌ Both modular and fallback note creation failed:', fallbackError.message);
                    }
                }
            } else {
                console.log('⚠️ Skipping note creation due to validation issues');
            }
            
            // Process appointment requests using modular system
            const fullCallData = {
                message: payload.message,
                call: call
            };
            const appointmentResult = await processAppointmentRequest(fullCallData, existingContact, extractedData, pitTokenManager);
            
            if (appointmentResult.processed) {
                if (appointmentResult.success) {
                    console.log('✅ Appointment processing completed successfully:', appointmentResult.appointmentId);
                } else {
                    console.log('❌ Appointment processing failed:', appointmentResult.error || appointmentResult.reason);
                }
            } else {
                console.log('ℹ️ No appointment requested in this call');
            }
            
            console.log('Async contact update completed successfully');
            
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    message: 'End-of-call report processed successfully',
                    contactId: contactId,
                    noteCreated: !!noteResult?.note?.id,
                    appointmentProcessed: appointmentResult?.processed || false,
                    appointmentCreated: appointmentResult?.success || false
                })
            };
        }
        
        // Handle other webhook types (placeholder for future)
        console.log('Unhandled webhook type, returning success');
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Webhook received but not processed' })
        };
        
    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
}