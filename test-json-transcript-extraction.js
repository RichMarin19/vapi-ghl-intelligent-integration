#!/usr/bin/env node

// Test JSON transcript parsing capabilities
import { SimpleQuestionMapper } from './simple-question-mapper.js';

// Example JSON transcript format that VAPI could send
const JSON_TRANSCRIPT = {
    "messages": [
        {
            "role": "assistant",
            "content": "Hi Michael! This is Olivia from Rich Murren Real Estate. I saw you're selling your home yourself. What's got you thinking about selling your home yourself instead of working with an agent?",
            "speaker": "Olivia",
            "timestamp": "2025-09-16T10:30:00Z"
        },
        {
            "role": "user", 
            "content": "Well, honestly I want to save on the commission and get the most money possible. These agent calls are driving me crazy.",
            "speaker": "Michael",
            "timestamp": "2025-09-16T10:30:15Z"
        },
        {
            "role": "assistant",
            "content": "I completely understand that. What's most important to you as you go through this selling process?",
            "speaker": "Olivia",
            "timestamp": "2025-09-16T10:30:30Z"
        },
        {
            "role": "user",
            "content": "I need to get $1.6 million for the house. That's my bottom line.",
            "speaker": "Michael", 
            "timestamp": "2025-09-16T10:30:45Z"
        },
        {
            "role": "assistant",
            "content": "That makes sense. Ideally, when would you like to have your home sold and be moved out?",
            "speaker": "Olivia",
            "timestamp": "2025-09-16T10:31:00Z"
        },
        {
            "role": "user",
            "content": "By February at the latest. I need to be in San Francisco by March for my new job.",
            "speaker": "Michael",
            "timestamp": "2025-09-16T10:31:15Z"
        },
        {
            "role": "assistant",
            "content": "Where are you planning to go after you sell?",
            "speaker": "Olivia",
            "timestamp": "2025-09-16T10:31:30Z"
        },
        {
            "role": "user",
            "content": "San Francisco. Got a great job opportunity out there.",
            "speaker": "Michael",
            "timestamp": "2025-09-16T10:31:45Z"
        }
    ]
};

// String format transcript (current format from test)
const STRING_TRANSCRIPT = "Michael: I'm frustrated by all these agent calls. I want to sell for $1.6 million by February to move to San Francisco. I'd be open to an agent if the buyer pays the commission.";

async function testJSONTranscriptExtraction() {
    console.log('🧪 TESTING JSON TRANSCRIPT EXTRACTION');
    console.log('================================================================================');
    
    const questionMapper = new SimpleQuestionMapper();
    
    console.log('📋 Testing JSON Transcript Format:');
    console.log('Structure:', JSON.stringify(JSON_TRANSCRIPT, null, 2));
    console.log('');
    
    // Test JSON format
    console.log('🔍 EXTRACTING FROM JSON TRANSCRIPT:');
    const jsonResults = await questionMapper.extractFromSummary('', JSON.stringify(JSON_TRANSCRIPT));
    
    console.log('JSON Results:');
    Object.entries(jsonResults).forEach(([field, data]) => {
        if (!field.startsWith('Last') && !field.startsWith('latest')) {
            console.log(`   📌 ${field}: "${data.value}" (${data.confidence}% confidence, source: ${data.source})`);
        }
    });
    
    console.log('');
    console.log('🔍 COMPARING WITH STRING TRANSCRIPT:');
    const stringResults = await questionMapper.extractFromSummary('', STRING_TRANSCRIPT);
    
    console.log('String Results:');
    Object.entries(stringResults).forEach(([field, data]) => {
        if (!field.startsWith('Last') && !field.startsWith('latest')) {
            console.log(`   📌 ${field}: "${data.value}" (${data.confidence}% confidence, source: ${data.source})`);
        }
    });
    
    console.log('');
    console.log('📊 COMPARISON SUMMARY:');
    const jsonFieldCount = Object.keys(jsonResults).filter(k => !k.startsWith('Last') && !k.startsWith('latest')).length;
    const stringFieldCount = Object.keys(stringResults).filter(k => !k.startsWith('Last') && !k.startsWith('latest')).length;
    
    console.log(`   JSON Format extracted: ${jsonFieldCount} fields`);
    console.log(`   String Format extracted: ${stringFieldCount} fields`);
    console.log('   JSON Format Benefits:');
    console.log('   ✅ Cleaner parsing (no regex needed)');
    console.log('   ✅ Structured speaker identification');
    console.log('   ✅ Timestamp support');
    console.log('   ✅ Message role clarity (assistant vs user)');
    console.log('   ✅ Better question-answer matching');
}

testJSONTranscriptExtraction();