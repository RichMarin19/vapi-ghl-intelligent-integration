#!/usr/bin/env node

// Simple Question-Based Field Mapper
// Maps VAPI prompt questions directly to custom fields

export class SimpleQuestionMapper {
    constructor() {
        this.questionMappings = new Map();
        this.initializeQuestionMappings();
    }

    initializeQuestionMappings() {
        // Direct question-to-field mappings from VAPI prompt
        this.questionMappings.set('motivation', {
            questions: [
                "What's got you thinking about selling your home yourself instead of working with an agent?",
                "what's got you thinking about selling",
                "thinking about selling your home yourself"
            ],
            fieldName: 'Motivation'
        });

        this.questionMappings.set('expectations', {
            questions: [
                "What's most important to you as you go through this selling process?",
                "what's most important to you",
                "most important to you as you go through this selling process"
            ],
            fieldName: 'Expectations'
        });

        this.questionMappings.set('disappointments', {
            questions: [
                "What's been the most challenging or disappointing part of selling on your own so far?",
                "most challenging or disappointing part",
                "disappointing part of selling on your own"
            ],
            fieldName: 'Disappointments'
        });

        this.questionMappings.set('concerns', {
            questions: [
                "Is there anything you're concerned about as you go through this on your own?",
                "anything you're concerned about",
                "concerned about as you go through this"
            ],
            fieldName: 'Concerns'
        });

        this.questionMappings.set('nextDestination', {
            questions: [
                "Where are you planning to go after you sell?",
                "where are you planning to go",
                "planning to go after you sell"
            ],
            fieldName: 'Next Destination'
        });

        this.questionMappings.set('timeline', {
            questions: [
                "Ideally, when would you like to have your home sold and be moved out?",
                "when would you like to have your home sold",
                "ideally, when would you like"
            ],
            fieldName: 'Timeline'
        });

        this.questionMappings.set('askingPrice', {
            questions: [
                "What price are you hoping to get for your home?",
                "what price are you hoping",
                "price are you hoping to get"
            ],
            fieldName: 'Asking Price'
        });

        this.questionMappings.set('opennessToRelist', {
            questions: [
                "If a great buyer came along, would you be open to working with an agent",
                "would you be open to working with an agent",
                "great buyer came along"
            ],
            fieldName: 'Openness to Re-list'
        });
    }

    extractFieldFromSummary(summary, fieldKey) {
        const mapping = this.questionMappings.get(fieldKey);
        if (!mapping) return null;

        const summaryLower = summary.toLowerCase();

        // Look for any of the question variations
        for (const question of mapping.questions) {
            const questionLower = question.toLowerCase();
            
            // Find the question in the summary
            const questionIndex = summaryLower.indexOf(questionLower);
            if (questionIndex === -1) continue;

            // Look for the answer after the question
            const afterQuestion = summary.substring(questionIndex + question.length);
            
            // Extract the answer (look for the next sentence or phrase)
            const answer = this.extractAnswer(afterQuestion);
            if (answer) {
                console.log(`📋 Found answer for ${mapping.fieldName}: "${answer}"`);
                return {
                    value: answer,
                    confidence: 90,
                    source: 'question_mapping'
                };
            }
        }

        return null;
    }

    extractAnswer(textAfterQuestion) {
        // Clean up the text
        let text = textAfterQuestion.trim();
        
        // Remove common filler words at the start
        text = text.replace(/^[\s,.\-:]+/, '');
        text = text.replace(/^(well|um|uh|so|like|you know|i mean)[\s,]+/i, '');
        
        // Extract until the next question or natural break
        const stopPatterns = [
            /\. [A-Z]/,  // Next sentence
            /\? /,       // Next question
            /\. The /,   // Natural break
            /\. Olivia/, // AI assistant name
            /\. They/,   // Natural break
            /\. Jack/    // Common name break
        ];
        
        let endIndex = text.length;
        for (const pattern of stopPatterns) {
            const match = text.search(pattern);
            if (match !== -1 && match < endIndex) {
                endIndex = match + 1; // Include the period
            }
        }
        
        let answer = text.substring(0, endIndex).trim();
        
        // Clean up the answer
        answer = answer.replace(/^[\s,.\-:]+/, '');
        answer = answer.replace(/[\s,.\-:]+$/, '');
        
        // Only return if it's a meaningful answer (not too short, not just punctuation)
        if (answer.length > 3 && /[a-zA-Z]/.test(answer)) {
            return answer;
        }
        
        return null;
    }

    // Direct information extraction when questions aren't present
    extractDirectFromSummary(summary) {
        console.log('🎯 Extracting directly from call summary (no questions found)');
        const extractedFields = {};
        const summaryLower = summary.toLowerCase();

        // Direct extraction based on summary content
        // Motivation: Look for WHY they want to sell FSBO (avoid frustrations - those are disappointments)
        if (summaryLower.includes('save commission') || summaryLower.includes('saving commission')) {
            extractedFields.motivation = {
                value: 'Save commission',
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('commission') && summaryLower.includes('money')) {
            extractedFields.motivation = {
                value: 'Save commission, get the most money',
                confidence: 85,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('to move to')) {
            extractedFields.motivation = {
                value: 'Relocation',
                confidence: 85,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('get the most money') || summaryLower.includes('maximize') && summaryLower.includes('money')) {
            extractedFields.motivation = {
                value: 'Get the most money',
                confidence: 85,
                source: 'direct_extraction'
            };
        }

        // Expectations: Look for price or process expectations
        const priceMatch = summary.match(/\$?([\d,]+\.?\d*)\s*(?:million|mil|M)/i);
        if (priceMatch) {
            const amount = priceMatch[1];
            extractedFields.expectations = {
                value: `$${amount}M`,
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('most money')) {
            extractedFields.expectations = {
                value: 'Get the most money possible',
                confidence: 85,
                source: 'direct_extraction'
            };
        }

        // Timeline: Look for time references
        const monthMatch = summary.match(/by\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i);
        if (monthMatch) {
            extractedFields.timeline = {
                value: monthMatch[1],
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('year-end') || summaryLower.includes('by year-end')) {
            extractedFields.timeline = {
                value: 'Year-end',
                confidence: 90,
                source: 'direct_extraction'
            };
        }

        // Next Destination: Look for location references
        const locationMatch = summary.match(/(?:to move to|moving to)\s+([A-Za-z\s]+?)(?:,|\.|$)/i);
        if (locationMatch) {
            extractedFields.nextDestination = {
                value: locationMatch[1].trim(),
                confidence: 90,
                source: 'direct_extraction'
            };
        }

        // Disappointments: Look for frustration or disappointment mentions
        if (summaryLower.includes('frustrated by agent calls') || 
            (summaryLower.includes('frustrated') && summaryLower.includes('agent'))) {
            extractedFields.disappointments = {
                value: 'Frustrated by agent calls',
                confidence: 95,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('concerns about buyer quality')) {
            extractedFields.disappointments = {
                value: 'Quality of buyers',
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('agent calls')) {
            extractedFields.disappointments = {
                value: 'Agent calls',
                confidence: 85,
                source: 'direct_extraction'
            };
        }

        // Concerns: Look for concern mentions
        if (summaryLower.includes('concerns about buyer quality')) {
            extractedFields.concerns = {
                value: 'Buyer quality',
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('frustrated by agent calls') || 
                   (summaryLower.includes('frustrated') && summaryLower.includes('agent'))) {
            extractedFields.concerns = {
                value: 'Agent calls',
                confidence: 90,
                source: 'direct_extraction'
            };
        }

        // Openness to Re-list: Look for agent openness mentions
        if (summaryLower.includes('open to') && summaryLower.includes('agent') && summaryLower.includes('buyer') && summaryLower.includes('commission')) {
            extractedFields.opennessToRelist = {
                value: 'Yes, if buyer pays commission',
                confidence: 90,
                source: 'direct_extraction'
            };
        } else if (summaryLower.includes('open to working with') && summaryLower.includes('agent')) {
            extractedFields.opennessToRelist = {
                value: 'Yes, open to agent',
                confidence: 85,
                source: 'direct_extraction'
            };
        }

        return extractedFields;
    }

    // Extract from actual call transcript using JSON structure
    extractFromTranscript(transcript) {
        console.log('📞 Extracting from call transcript using JSON structure');
        const extractedFields = {};
        
        try {
            // Try to parse transcript as JSON first
            let transcriptData;
            if (typeof transcript === 'string' && transcript.trim().startsWith('{')) {
                transcriptData = JSON.parse(transcript);
                console.log('📋 Parsed transcript as JSON structure');
            } else {
                // If not JSON, convert string transcript to structured format
                transcriptData = this.parseStringTranscriptToJSON(transcript);
                console.log('📋 Converted string transcript to JSON structure');
            }

            if (transcriptData && transcriptData.messages && Array.isArray(transcriptData.messages)) {
                console.log(`📝 Found ${transcriptData.messages.length} messages in transcript`);
                
                // Look for specific question-answer patterns
                for (const [fieldKey, mapping] of this.questionMappings) {
                    for (const question of mapping.questions) {
                        const answer = this.findAnswerInMessages(transcriptData.messages, question);
                        
                        if (answer) {
                            console.log(`🎯 Transcript Q&A found for ${mapping.fieldName}: "${answer}"`);
                            extractedFields[fieldKey] = {
                                value: answer,
                                confidence: 95,
                                source: 'transcript_json'
                            };
                            break; // Found answer for this field, move to next
                        }
                    }
                }
            } else {
                console.log('⚠️ Transcript not in expected JSON format, skipping transcript extraction');
            }
        } catch (error) {
            console.log('⚠️ Failed to parse transcript as JSON, skipping transcript extraction:', error.message);
        }

        return extractedFields;
    }

    // Convert string transcript to JSON structure
    parseStringTranscriptToJSON(transcript) {
        const messages = [];
        
        // Split by common speaker patterns
        const segments = transcript.split(/\b(AI Assistant|Olivia|Michael|Speaker|User|Assistant):\s*/i);
        
        let currentSpeaker = null;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i].trim();
            if (!segment) continue;
            
            // Check if this segment is a speaker name
            if (/^(AI Assistant|Olivia|Michael|Speaker|User|Assistant)$/i.test(segment)) {
                currentSpeaker = segment;
            } else if (currentSpeaker && segment.length > 0) {
                // This is message content
                messages.push({
                    role: currentSpeaker.toLowerCase().includes('assistant') || currentSpeaker.toLowerCase().includes('olivia') ? 'assistant' : 'user',
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
            
            const contentLower = message.content.toLowerCase();
            
            // Check if this message contains the question
            if (contentLower.includes(questionLower)) {
                // Look for the answer in the next user message
                for (let j = i + 1; j < messages.length; j++) {
                    const nextMessage = messages[j];
                    if (nextMessage.role === 'user' && nextMessage.content && nextMessage.content.trim().length > 3) {
                        return this.cleanAnswer(nextMessage.content);
                    }
                }
                
                // If no next user message, look for answer in the same message after the question
                const questionIndex = contentLower.indexOf(questionLower);
                if (questionIndex !== -1) {
                    const afterQuestion = message.content.substring(questionIndex + question.length);
                    const answer = this.cleanAnswer(afterQuestion);
                    if (answer && answer.length > 3) {
                        return answer;
                    }
                }
            }
        }
        
        return null;
    }

    // Clean and format the answer
    cleanAnswer(rawAnswer) {
        if (!rawAnswer) return null;
        
        let answer = rawAnswer.trim();
        
        // Remove common filler words and punctuation at the start
        answer = answer.replace(/^[\s,.\-:?!]+/, '');
        answer = answer.replace(/^(well|um|uh|so|like|you know|i mean|yeah|yes|no)[\s,]+/i, '');
        
        // Extract until natural break or end
        const stopPatterns = [
            /\.\s+[A-Z]/,     // Next sentence
            /\?\s+/,          // Next question
            /\.\s+The\s+/,    // Natural break
        ];
        
        let endIndex = answer.length;
        for (const pattern of stopPatterns) {
            const match = answer.search(pattern);
            if (match !== -1 && match < endIndex) {
                endIndex = match + 1; // Include the period
            }
        }
        
        answer = answer.substring(0, endIndex).trim();
        
        // Clean up final answer
        answer = answer.replace(/^[\s,.\-:?!]+/, '');
        answer = answer.replace(/[\s,.\-:?!]+$/, '');
        
        // Only return if it's meaningful
        if (answer.length > 3 && /[a-zA-Z]/.test(answer)) {
            return answer;
        }
        
        return null;
    }


    // Main extraction method with transcript and summary support
    async extractFromSummary(summary, transcript = null) {
        console.log('🎯 Using simple question-based mapping');
        const extractedFields = {};

        // Try transcript Q&A extraction first if transcript is available
        if (transcript && transcript.trim().length > 0) {
            console.log('📞 Trying transcript Q&A extraction first...');
            const transcriptFields = this.extractFromTranscript(transcript);
            Object.assign(extractedFields, transcriptFields);
            console.log(`📞 Transcript extraction found ${Object.keys(transcriptFields).length} fields`);
        }

        // Try summary question-based extraction for missing fields
        let questionFieldsFound = 0;
        for (const [fieldKey, mapping] of this.questionMappings) {
            if (extractedFields[fieldKey]) continue; // Skip if already found in transcript
            
            try {
                const result = this.extractFieldFromSummary(summary, fieldKey);
                if (result) {
                    extractedFields[fieldKey] = result;
                    questionFieldsFound++;
                }
            } catch (error) {
                console.error(`❌ Error extracting ${mapping.fieldName}:`, error.message);
            }
        }

        // Use direct extraction for any remaining missing fields
        const missingFields = Array.from(this.questionMappings.keys())
            .filter(fieldKey => !extractedFields[fieldKey]);
        
        if (missingFields.length > 0) {
            console.log(`🔄 Using direct extraction for ${missingFields.length} missing fields`);
            const directFields = this.extractDirectFromSummary(summary);
            
            // Only add direct fields that weren't already found
            for (const [fieldKey, fieldData] of Object.entries(directFields)) {
                if (!extractedFields[fieldKey]) {
                    extractedFields[fieldKey] = fieldData;
                }
            }
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

        console.log(`✅ Question-based extraction completed: ${Object.keys(extractedFields).length} fields`);
        return extractedFields;
    }
}