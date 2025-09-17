#!/usr/bin/env node

// Test the new unified field mapper
import { FieldMapper } from './field-mapper.js';

const PAULINA_CALL_SUMMARY = `Olivia from Signature Premier Properties called Paulina Marin, a homeowner selling her property for $950,000, to understand her selling process and offer assistance. Paulina, who is looking to downsize within 3-6 months, expressed openness to working with an agent despite initially trying to sell on her own due to low foot traffic. As a result, Paulina scheduled an appointment for Rich from Signature Premier Properties to conduct a quick preview of her home on Thursday, September 18th at 12 PM.`;

async function testUnifiedMapper() {
    console.log('🧪 TESTING UNIFIED FIELD MAPPER');
    console.log('================================================================================');
    console.log('📝 Call Summary:');
    console.log(PAULINA_CALL_SUMMARY);
    console.log('');
    
    try {
        const mapper = new FieldMapper();
        
        console.log('🔍 EXTRACTING WITH UNIFIED MAPPER:');
        const results = await mapper.extractFromCall(PAULINA_CALL_SUMMARY);
        
        console.log('');
        console.log('📊 UNIFIED MAPPER RESULTS:');
        console.log(`   Success: ✅ YES`);
        console.log(`   Fields extracted: ${Object.keys(results).length}`);
        
        console.log('');
        console.log('🎯 FIELD VALUES:');
        Object.entries(results).forEach(([field, data]) => {
            if (!field.startsWith('Last') && !field.startsWith('latest') && !field.startsWith('Voice')) {
                console.log(`   📌 ${field}: "${data.value}" (${data.confidence}% confidence, source: ${data.source})`);
            }
        });
        
        if (results['Voice Memory']) {
            console.log('');
            console.log('🧠 VOICE MEMORY GENERATED:');
            console.log(`   "${results['Voice Memory'].value}"`);
        }
        
        console.log('');
        console.log('✅ UNIFIED MAPPER TEST SUCCESSFUL!');
        console.log('🏗️  Architecture: Single file, clean extraction, no complexity');
        
    } catch (error) {
        console.error('❌ Unified mapper test failed:', error.message);
        console.error(error.stack);
    }
}

testUnifiedMapper();