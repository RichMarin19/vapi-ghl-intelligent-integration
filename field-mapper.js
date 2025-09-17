// field-mapper.js - Single Unified Field Extraction System
// Combines the best of SimpleQuestionMapper and IntelligentFieldMapper

export class FieldMapper {
    constructor() {
        // Question mappings for VAPI prompt-based extraction
        this.questionMappings = new Map([
            ['motivation', {
                fieldName: 'Motivation',
                questions: [
                    "What's got you thinking about selling your home yourself instead of working with an agent?",
                    "What motivated you to sell FSBO?",
                    "Why are you selling by owner?"
                ]
            }],
            ['expectations', {
                fieldName: 'Expectations', 
                questions: [
                    "What's most important to you as you go through this selling process?",
                    "What are you hoping to achieve?",
                    "What's your main goal?"
                ]
            }],
            ['disappointments', {
                fieldName: 'Disappointments',
                questions: [
                    "What's been the most challenging or disappointing part of selling on your own so far?",
                    "What has disappointed you?",
                    "What's been challenging?"
                ]
            }],
            ['concerns', {
                fieldName: 'Concerns',
                questions: [
                    "Is there anything you're concerned about as you go through this on your own?",
                    "What concerns do you have?",
                    "Any worries?"
                ]
            }],
            ['nextDestination', {
                fieldName: 'Next Destination',
                questions: [
                    "Where are you planning to go after you sell?",
                    "Where are you moving to?",
                    "What's your next destination?"
                ]
            }],
            ['timeline', {
                fieldName: 'Timeline', 
                questions: [
                    "Ideally, when would you like to have your home sold and be moved out?",
                    "What's your timeline?",
                    "When do you need to sell?"
                ]
            }],
            ['expectations', {
                fieldName: 'Expectations',
                questions: [
                    "What price are you hoping to get for your home?",
                    "How much are you asking?",
                    "What's your asking price?"
                ]
            }],
            ['opennessToRelist', {
                fieldName: 'Openness to Re-list',
                questions: [
                    "If a great buyer came along, would you be open to working with an agent?",
                    "Would you consider working with an agent?",
                    "Are you open to using an agent?"
                ]
            }]
        ]);
    }

    // Main extraction method - handles all field extraction
    async extractFromCall(summary, transcript = null) {
        console.log('🎯 Starting unified field extraction...');
        const extractedFields = {};

        try {
            // Try JSON transcript parsing first if available
            if (transcript && transcript.trim().length > 0) {
                console.log('📞 Attempting transcript-based extraction...');
                const transcriptFields = this.extractFromTranscript(transcript);
                Object.assign(extractedFields, transcriptFields);
                console.log(`📞 Transcript extraction: ${Object.keys(transcriptFields).length} fields found`);
            }

            // Extract from summary for any missing fields
            const missingFields = Array.from(this.questionMappings.keys())
                .filter(fieldKey => !extractedFields[fieldKey]);

            if (missingFields.length > 0) {
                console.log(`🧠 Extracting ${missingFields.length} missing fields from summary...`);
                const summaryFields = this.extractFromSummary(summary, missingFields);
                Object.assign(extractedFields, summaryFields);
            }

            // Add system fields
            extractedFields['Last Contact'] = {
                value: new Date().toISOString().split('T')[0],
                confidence: 100,
                source: 'system'
            };

            extractedFields['latest Call Summary'] = {
                value: summary,
                confidence: 100,
                source: 'system'
            };

            // Generate Voice Memory
            const voiceMemory = this.generateVoiceMemory(extractedFields);
            if (voiceMemory) {
                extractedFields['Voice Memory'] = voiceMemory;
            }

            console.log(`✅ Unified extraction completed: ${Object.keys(extractedFields).length} total fields`);
            return extractedFields;

        } catch (error) {
            console.error('❌ Unified field extraction failed:', error.message);
            throw error;
        }
    }

    // Extract from structured JSON transcript
    extractFromTranscript(transcript) {
        const extractedFields = {};
        
        try {
            let transcriptData;
            if (typeof transcript === 'string' && transcript.trim().startsWith('{')) {
                transcriptData = JSON.parse(transcript);
            } else {
                transcriptData = this.parseStringTranscriptToJSON(transcript);
            }

            if (transcriptData?.messages && Array.isArray(transcriptData.messages)) {
                for (const [fieldKey, mapping] of this.questionMappings) {
                    for (const question of mapping.questions) {
                        const answer = this.findAnswerInMessages(transcriptData.messages, question);
                        if (answer) {
                            extractedFields[fieldKey] = {
                                value: answer,
                                confidence: 95,
                                source: 'transcript'
                            };
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Transcript parsing failed, using summary extraction:', error.message);
        }

        return extractedFields;
    }

    // Convert string transcript to JSON structure  
    parseStringTranscriptToJSON(transcript) {
        const messages = [];
        const segments = transcript.split(/\b(AI Assistant|Olivia|Michael|Speaker|User|Assistant):\s*/i);
        
        let currentSpeaker = null;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i].trim();
            if (!segment) continue;
            
            if (/^(AI Assistant|Olivia|Michael|Speaker|User|Assistant)$/i.test(segment)) {
                currentSpeaker = segment;
            } else if (currentSpeaker && segment.length > 0) {
                messages.push({
                    role: currentSpeaker.toLowerCase().includes('assistant') || 
                          currentSpeaker.toLowerCase().includes('olivia') ? 'assistant' : 'user',
                    content: segment,
                    speaker: currentSpeaker
                });
            }
        }
        
        return { messages };
    }

    // Find answer in structured messages
    findAnswerInMessages(messages, question) {
        const questionLower = question.toLowerCase();
        
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message.content) continue;
            
            if (message.content.toLowerCase().includes(questionLower)) {
                // Look for answer in next user message
                for (let j = i + 1; j < messages.length; j++) {
                    const nextMessage = messages[j];
                    if (nextMessage.role === 'user' && nextMessage.content?.trim().length > 3) {
                        return this.cleanAnswer(nextMessage.content);
                    }
                }
            }
        }
        
        return null;
    }

    // Extract from summary using direct pattern matching
    extractFromSummary(summary, fieldsToExtract = null) {
        const extractedFields = {};
        const summaryLower = summary.toLowerCase();
        const fieldsToProcess = fieldsToExtract || Array.from(this.questionMappings.keys());

        for (const fieldKey of fieldsToProcess) {
            const fieldValue = this.extractFieldFromSummary(summary, fieldKey);
            if (fieldValue) {
                extractedFields[fieldKey] = fieldValue;
            }
        }

        return extractedFields;
    }

    // Extract specific field from summary
    extractFieldFromSummary(summary, fieldKey) {
        const summaryLower = summary.toLowerCase();

        switch (fieldKey) {
            case 'motivation':
                if (summaryLower.includes('save commission') || summaryLower.includes('saving commission')) {
                    return { value: 'Save commission', confidence: 90, source: 'summary' };
                } else if (summaryLower.includes('commission') && summaryLower.includes('money')) {
                    return { value: 'Save commission, get the most money', confidence: 85, source: 'summary' };
                } else if (summaryLower.includes('to move to')) {
                    return { value: 'Relocation', confidence: 85, source: 'summary' };
                }
                break;

            case 'expectations':
                const priceMatches = summary.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:million|m|k)?/gi);
                if (priceMatches) {
                    const price = priceMatches[0];
                    return { value: price, confidence: 90, source: 'summary' };
                } else if (summaryLower.includes('get the most money') || summaryLower.includes('maximize')) {
                    return { value: 'Get the most money', confidence: 80, source: 'summary' };
                }
                break;

            case 'timeline':
                const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                              'july', 'august', 'september', 'october', 'november', 'december'];
                for (const month of months) {
                    if (summaryLower.includes(month)) {
                        return { value: month.charAt(0).toUpperCase() + month.slice(1), confidence: 95, source: 'summary' };
                    }
                }
                if (summaryLower.includes('asap') || summaryLower.includes('as soon as possible')) {
                    return { value: 'ASAP', confidence: 90, source: 'summary' };
                }
                break;

            case 'nextDestination':
                const stateMatch = summary.match(/(?:moving to|relocating to|going to)\s+([A-Za-z\s]+)(?:[,.]|$)/i);
                if (stateMatch) {
                    return { value: stateMatch[1].trim(), confidence: 90, source: 'summary' };
                }
                break;

            case 'disappointments':
                if (summaryLower.includes('frustrated by agent calls') || 
                    (summaryLower.includes('frustrated') && summaryLower.includes('agent'))) {
                    return { value: 'Frustrated by agent calls', confidence: 95, source: 'summary' };
                } else if (summaryLower.includes('agent calls')) {
                    return { value: 'Agent calls', confidence: 85, source: 'summary' };
                } else if (summaryLower.includes('low foot traffic')) {
                    return { value: 'Low foot traffic', confidence: 90, source: 'summary' };
                }
                break;

            case 'concerns':
                if (summaryLower.includes('frustrated by agent calls') || 
                    (summaryLower.includes('frustrated') && summaryLower.includes('agent'))) {
                    return { value: 'Agent calls', confidence: 90, source: 'summary' };
                } else if (summaryLower.includes('timely manner') || summaryLower.includes('getting it done')) {
                    return { value: 'Getting it done in timely manner', confidence: 90, source: 'summary' };
                }
                break;

            case 'opennessToRelist':
                if (summaryLower.includes('open to working with an agent') || 
                    summaryLower.includes('would work with an agent')) {
                    if (summaryLower.includes('buyer pays') && summaryLower.includes('commission')) {
                        return { value: 'Yes, if buyer pays commission', confidence: 95, source: 'summary' };
                    } else {
                        return { value: 'Yes', confidence: 80, source: 'summary' };
                    }
                }
                break;
        }

        return null;
    }

    // Clean extracted answer
    cleanAnswer(rawAnswer) {
        if (!rawAnswer) return null;
        
        let answer = rawAnswer.trim();
        answer = answer.replace(/^[\s,.\-:?!]+/, '');
        answer = answer.replace(/^(well|um|uh|so|like|you know|i mean|yeah|yes|no)[\s,]+/i, '');
        
        const stopPatterns = [/\.\s+[A-Z]/, /\?\s+/, /\.\s+The\s+/];
        let endIndex = answer.length;
        for (const pattern of stopPatterns) {
            const match = answer.search(pattern);
            if (match !== -1 && match < endIndex) {
                endIndex = match + 1;
            }
        }
        
        answer = answer.substring(0, endIndex).trim();
        answer = answer.replace(/^[\s,.\-:?!]+/, '').replace(/[\s,.\-:?!]+$/, '');
        
        return answer.length > 3 && /[a-zA-Z]/.test(answer) ? answer : null;
    }

    // Generate Voice Memory from extracted fields
    generateVoiceMemory(extractedFields) {
        const voiceMemoryParts = [];
        
        if (extractedFields.motivation?.value) voiceMemoryParts.push(`Motivation: ${extractedFields.motivation.value}`);
        if (extractedFields.expectations?.value) voiceMemoryParts.push(`Expects: ${extractedFields.expectations.value}`);
        if (extractedFields.timeline?.value) voiceMemoryParts.push(`Timeline: ${extractedFields.timeline.value}`);
        if (extractedFields.concerns?.value) voiceMemoryParts.push(`Concern: ${extractedFields.concerns.value}`);
        if (extractedFields.opennessToRelist?.value) voiceMemoryParts.push(`Agent: ${extractedFields.opennessToRelist.value}`);
        if (extractedFields.nextDestination?.value && extractedFields.nextDestination.value !== 'Not specified') {
            voiceMemoryParts.push(`Moving: ${extractedFields.nextDestination.value}`);
        }

        if (voiceMemoryParts.length > 2) {
            const currentDate = new Date().toLocaleDateString();
            const currentCallMemory = voiceMemoryParts.join(' | ') + '.';
            
            return {
                value: `[${currentDate}] ${currentCallMemory}`,
                confidence: 95,
                source: 'generated'
            };
        }

        return null;
    }
}