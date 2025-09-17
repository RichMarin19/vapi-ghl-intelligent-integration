#!/usr/bin/env node

// Test with the ACTUAL call summary from Michael Jordan call shown in screenshot
import { CustomFieldsManager } from './custom-fields-manager.js';

const MICHAEL_JORDAN_CALL_SUMMARY = `Olivia, a real estate assistant, called Michael Jordan, an FSBO seller, to understand his situation and offer assistance. Michael, frustrated by agent calls, is looking to sell his home for $1.6 million by February to move to San Francisco, and is open to an agent if the buyer pays the commission. They scheduled a 10-minute preview with Rich Murren for tomorrow, September 17th, at 11:30 AM.`;

async function testMichaelJordanExtraction() {
    console.log('🔍 TESTING MICHAEL JORDAN CALL EXTRACTION');
    console.log('================================================================================');
    console.log('📝 Call Summary:');
    console.log(MICHAEL_JORDAN_CALL_SUMMARY);
    console.log('');
    
    try {
        // Test with Michael Jordan's webhook payload structure
        const webhookPayload = {
            type: 'end-of-call-report',
            summary: MICHAEL_JORDAN_CALL_SUMMARY,
            call: {
                id: 'test-michael-jordan-' + Date.now(),
                transcript: `Michael: I'm frustrated by all these agent calls. I want to sell for $1.6 million by February to move to San Francisco. I'd be open to an agent if the buyer pays the commission.`,
                customer: { number: '+15551234567' },
                startedAt: new Date(Date.now() - 600000).toISOString(),
                endedAt: new Date().toISOString(),
                analysis: { summary: MICHAEL_JORDAN_CALL_SUMMARY }
            }
        };

        console.log('🧠 Expected Field Values from Latest Call Summary:');
        console.log('   Motivation: "Relocation" (wants to move to San Francisco)');
        console.log('   Expectations: "$1.6 million"'); 
        console.log('   Timeline: "February"');
        console.log('   Next Destination: "San Francisco"');
        console.log('   Disappointments: "Frustrated by agent calls"');
        console.log('   Concerns: "Agent calls"');
        console.log('   Openness to Re-list: "Yes, if buyer pays commission"');
        console.log('');

        // Initialize custom fields manager
        const customFieldsManager = new CustomFieldsManager();
        await customFieldsManager.initialize();
        
        // Use a test contact ID
        const testContactId = 'jjYOawhhinftLJSQG3J2'; // Known working contact

        console.log('🤖 PROCESSING WITH LIVE DEPLOYED CODE...');
        const result = await customFieldsManager.processVAPICall(webhookPayload, testContactId);
        
        console.log('');
        console.log('📊 MICHAEL JORDAN EXTRACTION RESULTS:');
        console.log(`   Success: ${result.success ? '✅ YES' : '❌ NO'}`);
        console.log(`   Fields updated: ${result.fieldsUpdated}`);
        
        if (result.updatedFields && result.updatedFields.length > 0) {
            console.log('');
            console.log('🎯 FIELD VALUES (What actually got saved to GHL):');
            result.updatedFields.forEach(field => {
                const status = validateMichaelFieldResult(field.fieldName, field.value);
                console.log(`   📌 ${field.fieldName}: "${field.value}" ${status}`);
            });
        }
        
        if (result.extractedData) {
            console.log('');
            console.log('🔍 RAW EXTRACTION DATA:');
            const extractedFields = Object.keys(result.extractedData).filter(key => !key.startsWith('_'));
            extractedFields.forEach(field => {
                const data = result.extractedData[field];
                console.log(`   • ${field}: "${data.value}" (${data.confidence}% confidence)`);
            });
        }

    } catch (error) {
        console.error('❌ Michael Jordan extraction test failed:', error.message);
        console.error(error.stack);
    }
}

function validateMichaelFieldResult(fieldName, value) {
    const lowerValue = value.toLowerCase();
    
    switch (fieldName) {
        case 'Motivation':
            if (lowerValue.includes('relocation')) return '✅ CORRECT';
            return '❌ WRONG (should be "Relocation")';
            
        case 'Expectations':
            if (lowerValue.includes('1.6 million') || lowerValue.includes('$1.6')) return '✅ CORRECT';
            return '❌ WRONG (should be "$1.6 million")';
            
        case 'Timeline':
            if (lowerValue.includes('february')) return '✅ CORRECT';
            return '❌ WRONG (should be "February")';
            
        case 'Next Destination':
            if (lowerValue.includes('san francisco')) return '✅ CORRECT';
            return '❌ WRONG (should be "San Francisco")';
            
        case 'Disappointments':
            if (lowerValue.includes('frustrated by agent calls') || lowerValue.includes('frustrated') && lowerValue.includes('agent')) return '✅ CORRECT';
            return '❌ WRONG (should be "Frustrated by agent calls")';
            
        case 'Concerns':
            if (lowerValue.includes('agent calls') || (lowerValue.includes('agent') && lowerValue.includes('call'))) return '✅ CORRECT';
            return '❌ WRONG (should be "Agent calls")';
            
        case 'Openness to Re-list':
            if (lowerValue.includes('yes') && lowerValue.includes('buyer pays') && lowerValue.includes('commission')) return '✅ CORRECT';
            if (lowerValue.includes('yes')) return '⚠️ PARTIAL';
            return '❌ WRONG (should be "Yes, if buyer pays commission")';
            
        default:
            return '➖ OTHER';
    }
}

testMichaelJordanExtraction();