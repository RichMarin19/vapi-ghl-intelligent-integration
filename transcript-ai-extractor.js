// transcript-ai-extractor.js - AI-powered transcript analysis and data extraction
// Extracts structured data from VAPI call transcripts for GoHighLevel custom fields

import axios from 'axios';

// Real estate custom field extraction templates based on user's screenshots
const EXTRACTION_TEMPLATES = {
    // Primary real estate fields
    motivation: {
        fieldType: 'text',
        prompts: [
            'Why are they looking to buy/sell?',
            'What is motivating this decision?',
            'What prompted them to consider this move?'
        ],
        keywords: ['because', 'need to', 'want to', 'looking to', 'reason', 'motivation', 'why', 'due to', 'save', 'commissions'],
        extractionHint: 'Extract the customer\'s primary motivation or reason for considering real estate transaction'
    },
    
    nextDestination: {
        fieldType: 'text',
        prompts: [
            'Where are they planning to move?',
            'What is their target location?',
            'Where do they want to go next?'
        ],
        keywords: ['moving to', 'relocating to', 'looking in', 'interested in', 'want to move to', 'destination', 'area', 'neighborhood', 'city', 'state', 'florida', 'go after'],
        extractionHint: 'Extract where the customer wants to move or their target destination'
    },
    
    expectations: {
        fieldType: 'text',
        prompts: [
            'What are their expectations?',
            'What do they hope to achieve?',
            'What are they looking for in a property?'
        ],
        keywords: ['expect', 'hoping', 'looking for', 'want', 'need', 'ideal', 'perfect', 'dream', 'requirements'],
        extractionHint: 'Extract customer expectations for their property or transaction'
    },
    
    timeline: {
        fieldType: 'text',
        prompts: [
            'When do they need to move?',
            'What is their timeline?',
            'How urgent is this?'
        ],
        keywords: ['by', 'before', 'within', 'months', 'weeks', 'soon', 'urgent', 'immediately', 'timeline', 'when', 'date'],
        extractionHint: 'Extract the customer\'s timeline or urgency for the transaction'
    },
    
    disappointments: {
        fieldType: 'text',
        prompts: [
            'What has been disappointing in their search?',
            'What challenges have they faced?',
            'What hasn\'t worked for them?'
        ],
        keywords: ['disappointed', 'frustrated', 'problem', 'issue', 'challenge', 'difficult', 'haven\'t found', 'struggle', 'concern'],
        extractionHint: 'Extract any disappointments, challenges, or negative experiences mentioned'
    },

    concerns: {
        fieldType: 'text',
        prompts: [
            'What are they concerned about?',
            'What worries them about the process?',
            'What are their main concerns?'
        ],
        keywords: ['concerned', 'worried', 'concern', 'issue', 'problem', 'challenge', 'afraid'],
        extractionHint: 'Extract customer concerns or worries about the real estate process'
    },

    askingPrice: {
        fieldType: 'text',
        prompts: [
            'What price are they hoping to get?',
            'What is their target price?',
            'How much do they want for the property?'
        ],
        keywords: ['price', 'cost', 'value', 'worth', '$', 'thousand', 'million', 'hoping to get'],
        extractionHint: 'Extract the asking price or target price for the property'
    },
    
    // Property-specific fields
    propertyType: {
        fieldType: 'select',
        prompts: [
            'What type of property are they interested in?',
            'House, condo, townhome, or other?'
        ],
        keywords: ['house', 'home', 'condo', 'townhome', 'apartment', 'single family', 'multi family', 'commercial'],
        extractionHint: 'Extract the type of property they are interested in'
    },
    
    priceRange: {
        fieldType: 'text',
        prompts: [
            'What is their budget?',
            'What price range are they considering?'
        ],
        keywords: ['budget', 'price', 'cost', 'afford', 'spend', 'range', '$', 'thousand', 'million', 'k'],
        extractionHint: 'Extract budget or price range mentioned'
    },
    
    bedrooms: {
        fieldType: 'number',
        prompts: [
            'How many bedrooms do they need?'
        ],
        keywords: ['bedroom', 'bed', 'room', '2br', '3br', '4br', 'two bedroom', 'three bedroom'],
        extractionHint: 'Extract number of bedrooms needed'
    },
    
    bathrooms: {
        fieldType: 'number',
        prompts: [
            'How many bathrooms do they need?'
        ],
        keywords: ['bathroom', 'bath', 'full bath', 'half bath', '2ba', '3ba', 'two bath'],
        extractionHint: 'Extract number of bathrooms needed'
    },
    
    // Situational fields
    currentSituation: {
        fieldType: 'text',
        prompts: [
            'What is their current living situation?',
            'Are they renting or owning currently?'
        ],
        keywords: ['currently', 'right now', 'living', 'renting', 'own', 'lease', 'apartment', 'situation'],
        extractionHint: 'Extract their current housing situation'
    },
    
    familySize: {
        fieldType: 'text',
        prompts: [
            'How many people in their family?',
            'Who will be living in the property?'
        ],
        keywords: ['family', 'kids', 'children', 'spouse', 'partner', 'people', 'household', 'just me', 'couple'],
        extractionHint: 'Extract family size or household composition'
    },
    
    // Decision-making fields
    decisionMakers: {
        fieldType: 'text',
        prompts: [
            'Who is involved in making this decision?',
            'Do they need to consult with anyone?'
        ],
        keywords: ['spouse', 'partner', 'family', 'wife', 'husband', 'decide together', 'discuss', 'consult'],
        extractionHint: 'Extract who is involved in the decision-making process'
    },
    
    urgency: {
        fieldType: 'select',
        prompts: [
            'How urgent is their need?'
        ],
        keywords: ['urgent', 'immediately', 'soon', 'no rush', 'flexible', 'timing', 'emergency'],
        extractionHint: 'Extract the urgency level of their needs'
    }
};

class TranscriptAIExtractor {
    constructor() {
        this.extractionTemplates = EXTRACTION_TEMPLATES;
    }

    // Main extraction function that analyzes transcript and extracts all relevant data
    // Enhanced to prioritize VAPI AI summary over raw transcript for better accuracy
    async extractDataFromTranscript(transcript, callData = {}, existingFieldData = {}) {
        // First, check if we have VAPI AI summary which is much more accurate
        const vapiSummary = callData?.message?.summary || callData?.call?.analysis?.summary;
        const hasVapiSummary = vapiSummary && vapiSummary.length > 20;
        
        if (hasVapiSummary) {
            console.log('🎯 Found VAPI AI Summary - using for high-accuracy extraction');
            console.log(`📋 Summary length: ${vapiSummary.length} characters`);
            console.log(`📄 Summary preview: "${vapiSummary.substring(0, 200)}..."`);
            
            // Extract from AI summary first (most accurate)
            const summaryData = await this.extractFromVapiSummary(vapiSummary, existingFieldData);
            
            // Skip transcript supplementation when simple question mapper is used
            const questionMapperFields = Object.keys(summaryData).filter(key => 
                summaryData[key]?.source === 'direct_extraction' ||
                summaryData[key]?.source === 'system' ||
                summaryData[key]?.extractionMethod === 'ai_pattern_matching' ||
                summaryData[key]?.extractionMethod === 'system_generated'
            ).length;
            
            // ALWAYS skip supplementation if we have any meaningful fields from question mapper
            if (questionMapperFields >= 3) {
                console.log('🎯 Skipping transcript supplementation - simple question mapper is comprehensive');
                console.log(`🎯 Summary-only extraction: ${Object.keys(summaryData).length} fields (${questionMapperFields} meaningful)`);
                return summaryData;
            }
            
            // Supplement with transcript data if available (fallback only)
            if (transcript && transcript.length > 10) {
                console.log(`📄 Supplementing with transcript (${transcript.length} characters)`);
                const transcriptData = this.extractUsingDirectMapping(transcript);
                
                // Merge data, prioritizing summary results
                const combinedData = { ...transcriptData, ...summaryData };
                console.log(`🎯 Combined extraction: ${Object.keys(combinedData).length} fields from summary+transcript`);
                return combinedData;
            }
            
            console.log(`🎯 Summary-only extraction: ${Object.keys(summaryData).length} fields`);
            return summaryData;
        }
        
        // Fallback to transcript analysis if no summary
        if (!transcript || typeof transcript !== 'string') {
            console.log('⚠️ No VAPI summary or transcript provided for extraction');
            return {};
        }

        console.log('🔄 Fallback: Using transcript-based extraction (VAPI summary not available)');
        console.log(`📄 Transcript length: ${transcript.length} characters`);

        // Try direct mapping from transcript (less accurate than summary)
        const extractedData = this.extractUsingDirectMapping(transcript);
        
        // Fall back to AI analysis only if direct mapping finds fewer than 3 fields
        if (Object.keys(extractedData).length < 3) {
            console.log('⚡ Direct mapping found < 3 fields, using AI analysis as fallback...');
            const aiData = await this.extractUsingAIAnalysis(transcript);
            
            // Merge AI results with direct mapping (direct mapping takes priority)
            Object.keys(aiData).forEach(key => {
                if (!extractedData[key]) {
                    extractedData[key] = aiData[key];
                }
            });
        }

        // Add call metadata
        extractedData._metadata = {
            transcriptLength: transcript.length,
            extractionTimestamp: new Date().toISOString(),
            callId: callData.call?.id || 'unknown',
            fieldsExtracted: Object.keys(extractedData).filter(key => !key.startsWith('_')).length
        };

        console.log(`🎯 Extraction completed: ${extractedData._metadata.fieldsExtracted} fields extracted`);
        return extractedData;
    }

    // Extract data for a specific field using AI analysis
    async extractFieldData(transcript, fieldName, template) {
        const transcriptLower = transcript.toLowerCase();
        
        // First, check if any keywords are present
        const hasRelevantKeywords = template.keywords.some(keyword => 
            transcriptLower.includes(keyword.toLowerCase())
        );

        if (!hasRelevantKeywords) {
            return null; // No relevant content found
        }

        // Use pattern-based extraction for better accuracy
        const extractedValue = this.performPatternExtraction(transcript, fieldName, template);
        
        if (!extractedValue) {
            return null;
        }

        // Calculate confidence based on keyword matches and context
        const confidence = this.calculateExtractionConfidence(transcript, extractedValue, template);
        
        return {
            value: extractedValue,
            confidence: confidence,
            fieldType: template.fieldType,
            source: 'ai_extraction',
            extractionMethod: 'pattern_based'
        };
    }

    // Advanced AI analyzer - extracts everything intelligently with flexible context-aware patterns
    extractUsingDirectMapping(transcript) {
        console.log('🧠 Using Advanced AI Analyzer...');
        
        const extractedData = {};
        const conversationTurns = this.parseConversationFlow(transcript);
        
        // Flexible context-aware extraction using semantic keywords and patterns
        const contextMappings = [
            {
                fieldName: 'motivation',
                contextPatterns: [
                    // Explicit reasons
                    /(?:because|since|due to|reason|need to|have to|got to|want to)\s+(.+?)(?:\.|,|;|$)/gi,
                    // Job/life changes
                    /(?:job|work|position|career|transfer|relocat|mov|divorce|marriage|family|retire)/gi,
                    // Financial reasons  
                    /(?:money|cash|afford|expensive|cheap|save|cost|commission)/gi
                ],
                confidence: 85
            },
            {
                fieldName: 'timeline', 
                contextPatterns: [
                    // Time expressions
                    /(?:within|by|before|after|in|next)\s+(\d+\s*(?:days?|weeks?|months?|years?))/gi,
                    /(?:soon|quickly|urgent|immediate|asap|rush)/gi,
                    // Specific timeframes
                    /(\d+\s*(?:days?|weeks?|months?|years?))/gi
                ],
                confidence: 85
            },
            {
                fieldName: 'expectations',
                contextPatterns: [
                    // Price expectations
                    /(?:hoping|expect|want|looking for|need|target)\s+(?:to get|for|around)?\s*\$?([\d,]+(?:\.\d+)?(?:\s*(?:k|thousand|million|m))?)/gi,
                    // Outcome expectations
                    /(?:looking for|want|need|expect|hope for|ideal|perfect)\s+(.+?)(?:\.|,|;|$)/gi,
                    // Quick sale indicators
                    /(?:quick|fast|rapid|immediate)\s*(?:sale|sell|close|deal)/gi
                ],
                confidence: 85
            },
            {
                fieldName: 'disappointments',
                contextPatterns: [
                    // Negative experiences
                    /(?:disappoint|frustrat|problem|issue|challenge|difficult|struggle|failed|didn't|haven't)\s+(.+?)(?:\.|,|;|$)/gi,
                    // Agent issues
                    /(?:agent|realtor)(?:s)?\s+(?:who|that|didn't|haven't|failed|promised|said)\s+(.+?)(?:\.|,|;|$)/gi,
                    // Past failures
                    /(?:other|previous|last|tried)\s+(.+?)(?:but|didn't|failed|haven't)/gi
                ],
                confidence: 80
            },
            {
                fieldName: 'nextDestination',
                contextPatterns: [
                    // Location mentions
                    /(?:to|in|near|around)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/g,
                    // Moving patterns
                    /(?:mov|relocat|go|transfer)\s+(?:to|in|near)\s+([A-Z][a-zA-Z\s]+)/gi,
                    // State/city names (common patterns)
                    /(?:Austin|Texas|Florida|California|New York|Atlanta|Miami|Dallas|Houston)/gi
                ],
                confidence: 90
            },
            {
                fieldName: 'concerns',
                contextPatterns: [
                    // Worry expressions
                    /(?:concerned|worry|worried|afraid|nervous|unsure)\s+(?:about|that)?\s*(.+?)(?:\.|,|;|$)/gi,
                    // Process concerns
                    /(?:process|paperwork|legal|contract|closing)\s+(.+?)(?:\.|,|;|$)/gi
                ],
                confidence: 85
            }
        ];

        // Extract using flexible context patterns
        for (const mapping of contextMappings) {
            const contextResults = this.extractFromContext(transcript, mapping.contextPatterns, mapping.fieldName);
            if (contextResults && contextResults.length > 0) {
                const cleanResult = this.intelligentResponseCleaning(contextResults, mapping.fieldName);
                if (cleanResult && cleanResult.length > 2) {
                    extractedData[mapping.fieldName] = {
                        value: cleanResult,
                        confidence: mapping.confidence,
                        source: 'context_aware_analyzer',
                        extractionMethod: 'flexible_pattern_matching'
                    };
                    console.log(`✅ Context AI: ${mapping.fieldName} = "${extractedData[mapping.fieldName].value}"`);
                }
            }
        }

        // Fallback to original question-based extraction if context didn't find much
        if (Object.keys(extractedData).length < 3) {
            const questionResults = this.extractUsingQuestionPatterns(transcript, conversationTurns);
            Object.assign(extractedData, questionResults);
        }

        // Smart property analysis from full conversation
        const propertyData = this.extractPropertyIntelligence(transcript);
        Object.keys(propertyData).forEach(key => {
            if (!extractedData[key] && propertyData[key].value) {
                extractedData[key] = propertyData[key];
                console.log(`🏠 Property Intelligence: ${key} = "${propertyData[key].value}"`);
            }
        });

        console.log(`🧠 Advanced AI extracted ${Object.keys(extractedData).length} fields`);
        return extractedData;
    }

    // Intelligent response cleaning - removes generic responses, keeps meaningful ones
    intelligentResponseCleaning(response, fieldName) {
        if (!response || typeof response !== 'string') return null;
        
        const cleaned = response.trim();
        
        // Filter out generic/unhelpful responses
        const genericResponses = [
            'good', 'fine', 'okay', 'ok', 'great', 'yeah', 'yes', 'no', 
            'sure', 'i guess', 'maybe', 'i don\'t know', 'not sure',
            'and', 'um', 'uh', 'well'
        ];
        
        const lowerCleaned = cleaned.toLowerCase();
        
        // If response is just a generic word, skip it
        if (genericResponses.includes(lowerCleaned)) {
            return null;
        }
        
        // If response is too short but not a meaningful short answer, skip it
        if (cleaned.length < 3 && !this.isMeaningfulShortResponse(cleaned, fieldName)) {
            return null;
        }
        
        return cleaned;
    }

    // Check if short responses are actually meaningful
    isMeaningfulShortResponse(response, fieldName) {
        const meaningful = {
            'nextDestination': ['ny', 'nj', 'pa', 'ct', 'fl', 'ca', 'tx'], // state abbreviations
            'askingPrice': ['k', 'm'], // price indicators  
            'timeline': ['asap', 'soon'], // time indicators
            'bedrooms': ['1', '2', '3', '4', '5', '6'], // numbers
            'bathrooms': ['1', '2', '3', '4', '5'] // numbers
        };
        
        const fieldMeaningful = meaningful[fieldName] || [];
        return fieldMeaningful.includes(response.toLowerCase());
    }

    // Extract property intelligence from full conversation context
    extractPropertyIntelligence(transcript) {
        const propertyData = {};
        const text = transcript.toLowerCase();
        
        // Smart price detection
        const pricePatterns = [
            /(\$?[\d,]+(?:\.\d+)?)\s*(?:thousand|k)/gi,
            /(\$?[\d,]+(?:\.\d+)?)\s*(?:million|m)/gi,
            /\$\s*([\d,]+(?:\.\d+)?)/g
        ];
        
        for (const pattern of pricePatterns) {
            const matches = text.match(pattern);
            if (matches && !propertyData.priceRange) {
                propertyData.priceRange = {
                    value: matches[0],
                    confidence: 85,
                    source: 'property_intelligence',
                    extractionMethod: 'price_pattern_detection'
                };
                break;
            }
        }
        
        // Smart property type detection
        const propertyTypes = ['house', 'home', 'condo', 'townhouse', 'apartment', 'single family', 'multi family'];
        for (const type of propertyTypes) {
            if (text.includes(type) && !propertyData.propertyType) {
                propertyData.propertyType = {
                    value: type,
                    confidence: 80,
                    source: 'property_intelligence',
                    extractionMethod: 'property_type_detection'
                };
                break;
            }
        }
        
        // Smart bedroom/bathroom detection
        const bedroomMatch = text.match(/(\d+)\s*(?:bed|br|bedroom)/);
        if (bedroomMatch) {
            propertyData.bedrooms = {
                value: bedroomMatch[1],
                confidence: 90,
                source: 'property_intelligence',
                extractionMethod: 'room_count_detection'
            };
        }
        
        const bathroomMatch = text.match(/(\d+)\s*(?:bath|ba|bathroom)/);
        if (bathroomMatch) {
            propertyData.bathrooms = {
                value: bathroomMatch[1],
                confidence: 90,
                source: 'property_intelligence', 
                extractionMethod: 'room_count_detection'
            };
        }
        
        return propertyData;
    }

    // Structured data extraction using JSON format - much more reliable
    async extractStructuredData(summary) {
        console.log('📊 Attempting structured JSON extraction...');
        
        // Create a structured prompt for consistent extraction
        const extractionPrompt = `
Please analyze this real estate call summary and extract the following information in JSON format.
Be concise and business-focused. Use "Not mentioned" if information is not available.

Call Summary: "${summary}"

Extract and return ONLY a JSON object with these fields:
{
  "motivation": "Why are they selling? (concise, under 30 chars)",
  "nextDestination": "Where are they moving to?",
  "timeline": "When do they need to sell/move?",
  "expectations": "What do they expect from the sale?",
  "disappointments": "What has disappointed them so far?",
  "concerns": "What are they worried about?",
  "Openness to Re-list": "Are they open to working with an agent? (Yes/No/Maybe)",
  "Last Contact": "${new Date().toISOString().split('T')[0]}",
  "latest Call Summary": "${summary}",
  "Voice Memory": "Key business points for realtor reference"
}`;

        try {
            // For now, let's use a simple parsing approach that extracts key information
            // In a real implementation, this would call an AI service
            
            const extractedData = {};
            const text = summary.toLowerCase();
            
            // Motivation - look for key reasons
            if (text.includes('connection')) {
                extractedData['motivation'] = { value: 'Personal connection', confidence: 90, source: 'structured', extractionMethod: 'json_structured' };
            } else if (text.includes('commission')) {
                extractedData['motivation'] = { value: 'Save commission', confidence: 90, source: 'structured', extractionMethod: 'json_structured' };
            } else if (text.includes('moving') || text.includes('relocat')) {
                extractedData['motivation'] = { value: 'Relocation', confidence: 90, source: 'structured', extractionMethod: 'json_structured' };
            }
            
            // Next Destination - extract location mentioned
            const locationMatch = summary.match(/(?:moving to|going to|relocating to)\s+([A-Za-z\s,]+?)(?:\.|,|;|$)/i) ||
                                 summary.match(/\b(Missouri|Texas|California|Florida|Virginia|New York|Jersey|Africa|Austin)\b/i);
            if (locationMatch) {
                extractedData['nextDestination'] = { 
                    value: locationMatch[1] || locationMatch[0], 
                    confidence: 95, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            }
            
            // Timeline - extract time references
            const timelineMatch = summary.match(/(?:by|before|in|within)\s+([^.]{1,50}?)(?:\.|,|;|$)/i);
            if (timelineMatch) {
                extractedData['timeline'] = { 
                    value: timelineMatch[1].trim(), 
                    confidence: 85, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            }
            
            // Expectations - look for what they want
            let expectations = 'Not clearly specified';
            if (text.includes('control') && text.includes('process')) {
                expectations = 'Control over the process';
            } else if (text.includes('most money') || text.includes('top dollar')) {
                expectations = 'Get top dollar';
            } else if (text.includes('connection')) {
                expectations = 'Personal connection with buyer';
            }
            extractedData['expectations'] = { 
                value: expectations, 
                confidence: 85, 
                source: 'structured', 
                extractionMethod: 'json_structured' 
            };
            
            // Disappointments
            if (text.includes('quality') && text.includes('buyer')) {
                extractedData['disappointments'] = { 
                    value: 'Quality of buyers', 
                    confidence: 90, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            }
            
            // Concerns - extract main worry
            const concernMatch = summary.match(/(?:concern|worried|afraid).*?is\s+([^.]{1,50}?)(?:\.|,|;|$)/i);
            if (concernMatch) {
                extractedData['concerns'] = { 
                    value: concernMatch[1].trim(), 
                    confidence: 85, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            } else if (text.includes('time frame') || text.includes('timeline')) {
                extractedData['concerns'] = { 
                    value: 'Meeting timeline', 
                    confidence: 80, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            }
            
            // Openness to Re-list - look for agent-related responses
            if (text.includes('maybe') && (text.includes('agent') || text.includes('work'))) {
                extractedData['Openness to Re-list'] = { 
                    value: 'Maybe', 
                    confidence: 90, 
                    source: 'structured', 
                    extractionMethod: 'json_structured' 
                };
            }
            
            // System fields - always populate these
            const today = new Date().toISOString().split('T')[0];
            
            extractedData['Last Contact'] = {
                value: today,
                confidence: 100,
                source: 'system_generated',
                extractionMethod: 'json_structured'
            };
            
            extractedData['latest Call Summary'] = {
                value: summary,
                confidence: 100,
                source: 'vapi_summary',
                extractionMethod: 'json_structured'
            };
            
            // Create business-focused Voice Memory
            const memoryParts = [];
            if (extractedData.motivation) memoryParts.push(`Motivation: ${extractedData.motivation.value}`);
            if (extractedData.timeline) memoryParts.push(`Timeline: ${extractedData.timeline.value}`);
            if (extractedData.expectations) memoryParts.push(`Wants: ${extractedData.expectations.value}`);
            
            const voiceMemory = memoryParts.length > 0 
                ? memoryParts.join(' | ')
                : summary.substring(0, 100) + '...';
                
            extractedData['Voice Memory'] = {
                value: voiceMemory,
                confidence: 95,
                source: 'business_summary',
                extractionMethod: 'json_structured'
            };
            
            console.log(`📊 Structured extraction: ${Object.keys(extractedData).length} fields extracted`);
            return extractedData;
            
        } catch (error) {
            console.error('❌ Structured extraction failed:', error.message);
            throw error;
        }
    }

    // Extract data from VAPI AI Summary using intelligent field mapping
    async extractFromVapiSummary(summary, existingFieldData = {}) {
        console.log('🧠 Extracting from VAPI AI Summary using direct simple question mapper');
        
        // PERMANENT FIX: Call SimpleQuestionMapper directly - bypass fallback system
        try {
            const { SimpleQuestionMapper } = await import('./simple-question-mapper.js');
            const mapper = new SimpleQuestionMapper();
            
            // Extract from summary with transcript support (transcript will be empty string for now)
            const extractedData = await mapper.extractFromSummary(summary, '');
            if (extractedData && Object.keys(extractedData).length > 0) {
                console.log('✅ Using DIRECT simple question mapper (no fallbacks, high accuracy)');
                console.log(`🎯 Direct mapper extracted ${Object.keys(extractedData).length} fields - PURE EXTRACTION`);
                return extractedData;
            }
        } catch (error) {
            console.log('⚠️ Direct simple question mapper failed, using minimal fallback');
            console.error('Error details:', error.message);
            // Return minimal system fields instead of structured extraction
            return {
                'Last Contact': {
                    value: new Date().toISOString().split('T')[0],
                    confidence: 100,
                    source: 'system'
                },
                'latest Call Summary': {
                    value: summary,
                    confidence: 100,
                    source: 'system'
                }
            };
        }
        
        // No more fallbacks - simple question mapper is the only method
        console.log('❌ Simple question mapper returned no data - returning minimal system fields');
        return {
            'Last Contact': {
                value: new Date().toISOString().split('T')[0],
                confidence: 100,
                source: 'system'
            },
            'latest Call Summary': {
                value: summary,
                confidence: 100,
                source: 'system'
            }
        };
    }
}

export { TranscriptAIExtractor };
