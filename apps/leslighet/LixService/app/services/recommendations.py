"""
Readability recommendations generator for LixService.
Generates detailed recommendations for improving text readability.
"""
from typing import Dict, List, Any, Optional

class ReadabilityRecommender:
    """Generates detailed recommendations based on readability metrics."""
    
    def generate(self, metrics: Dict[str, Any], simplified: bool = False) -> List[Dict[str, Any]]:
        """
        Generate detailed recommendations for improving readability based on metrics.
        
        Args:
            metrics: Dictionary containing readability metrics
            simplified: Whether to generate simplified recommendations for WebSocket responses
            
        Returns:
            List of recommendation objects with detailed information
        """
        lix_score = metrics.get("lix_score", 0)
        rix_score = metrics.get("rix_score", 0)
        avg_sentence_length = metrics.get("avg_sentence_length", 0)
        long_words_percentage = metrics.get("long_words_percentage", 0)
        user_context = metrics.get("user_context", {})
        
        recommendations = []
        
        # Sentence structure recommendations
        if avg_sentence_length > 18:
            recommendations.append({
                "type": "sentence_structure",
                "title": "Kortere setninger",
                "description": f"Gjennomsnittlig setningslengde er {round(avg_sentence_length, 1)} ord, som er relativt høyt.",
                "suggestion": "Del lange setninger i to eller flere kortere setninger for bedre forståelse.",
                "impact": "high" if avg_sentence_length > 25 else "medium",
                # Only include examples in full mode
                "examples": [] if simplified else [
                    "Før: 'Det er viktig å vurdere alle faktorene som påvirker resultatet, inkludert eksterne variabler som vær og tilgjengelighet av materialer, samt interne faktorer som gjennomføringskapasitet og kvalitetssikring.'",
                    "Etter: 'Det er viktig å vurdere alle faktorene som påvirker resultatet. Dette inkluderer eksterne variabler som vær og tilgjengelighet av materialer. Interne faktorer som gjennomføringskapasitet og kvalitetssikring må også vurderes.'"
                ]
            })
        
        # Word complexity recommendations
        if long_words_percentage > 25:
            recommendations.append({
                "type": "word_complexity",
                "title": "Enklere ordvalg",
                "description": f"{round(long_words_percentage, 1)}% av ordene er lange (7+ bokstaver).",
                "suggestion": "Bruk kortere og mer vanlige ord for å gjøre teksten mer tilgjengelig.",
                "impact": "high" if long_words_percentage > 35 else "medium",
                "examples": [
                    "Erstatt 'implementere' med 'bruke'",
                    "Erstatt 'signifikant' med 'viktig'",
                    "Erstatt 'kommunisere' med 'si fra'",
                    "Erstatt 'funksjoner' med 'egenskaper'"
                ]
            })
        
        # Style recommendations (for moderate to complex text)
        if lix_score > 40:
            recommendations.append({
                "type": "writing_style",
                "title": "Aktivt språk",
                "description": "Passivt språk gjør teksten tyngre å lese.",
                "suggestion": "Bruk aktiv form fremfor passiv form når mulig.",
                "impact": "medium",
                "examples": [
                    "Passiv: 'Beslutningen ble tatt av styret.'",
                    "Aktiv: 'Styret tok beslutningen.'"
                ]
            })
            
            recommendations.append({
                "type": "flow_improvement",
                "title": "Bedre tekstflyt",
                "description": "Manglende bindeord kan gjøre teksten oppstykket.",
                "suggestion": "Bruk bindeord for å skape sammenheng mellom setninger og avsnitt.",
                "impact": "medium",
                "examples": [
                    "Legge til: 'derfor', 'fordi', 'likevel', 'dessuten'",
                    "Eksempel: 'Han kom for sent. Han mistet bussen.' → 'Han kom for sent fordi han mistet bussen.'"
                ]
            })
        
        # Technical language recommendations (for complex text)
        if lix_score > 50:
            recommendations.append({
                "type": "technical_language",
                "title": "Fagbegreper",
                "description": "Høy LIX-score (over 50) tyder på mange fagbegreper.",
                "suggestion": "Forklar eller erstatt fagterminologi når mulig.",
                "impact": "high",
                "examples": [
                    "Forklar begreper når de introduseres: 'Kognitiv dissonans (følelsen av ubehag når man holder motstridende overbevisninger) er et vanlig psykologisk fenomen.'",
                    "Bruk enklere synonymer når mulig"
                ]
            })
            
            recommendations.append({
                "type": "structure_improvement",
                "title": "Forbedre tekststruktur",
                "description": "Komplekse tekster trenger tydelig struktur.",
                "suggestion": "Del teksten i kortere avsnitt med tydelige overskrifter og punktlister.",
                "impact": "high",
                "examples": [
                    "Bruk overskrifter for å dele opp lange tekster",
                    "Bruk punktlister for å presentere relatert informasjon",
                    "Hold avsnitt under 4-5 setninger"
                ]
            })
        
        # Visual recommendations
        if lix_score > 45:
            recommendations.append({
                "type": "visual_aids",
                "title": "Visuelle hjelpemidler",
                "description": "Kompleks informasjon kan presenteres visuelt.",
                "suggestion": "Inkluder tabeller, diagrammer eller illustrasjoner for å forklare komplekse konsepter.",
                "impact": "medium",
                "examples": [
                    "Bruk diagrammer for å vise sammenhenger",
                    "Bruk tabeller for å organisere data",
                    "Legg til illustrasjoner for å forklare prosesser"
                ]
            })
        
        # Consider user context if provided
        if user_context:
            purpose = user_context.get("purpose")
            if purpose == "education" and lix_score > 35:
                recommendations.append({
                    "type": "educational_content",
                    "title": "Tilpass for læring",
                    "description": "Teksten kan være krevende for en utdanningskontekst.",
                    "suggestion": "Bruk pedagogiske virkemidler som eksempler, oppsummeringer og visuelle hjelpemidler.",
                    "impact": "high",
                    "examples": [
                        "Legg til: 'For eksempel...' for å illustrere komplekse konsepter",
                        "Bruk oppsummeringspunkter etter lengre avsnitt",
                        "Inkluder visuelle hjelpemidler for å støtte teksten"
                    ]
                })
            elif purpose == "business" and lix_score > 45:
                recommendations.append({
                    "type": "business_communication",
                    "title": "Fokuser budskapet",
                    "description": "Forretningskommunikasjon bør være klar og konsis.",
                    "suggestion": "Bruk aktiv stemme, fremhev nøkkelpunkter og unngå unødvendig jargong.",
                    "impact": "medium",
                    "examples": [
                        "Start med hovedpoenget i hvert avsnitt",
                        "Bruk kulepunkter for viktige elementer",
                        "Unngå passive formuleringer: 'Rapporten ble utarbeidet' → 'Vi utarbeidet rapporten'"
                    ]
                })
        
        # RIX-specific recommendations 
        if rix_score > 4.0:
            recommendations.append({
                "type": "rix_recommendation",
                "title": "Balansere ordlengde",
                "description": f"RIX-score på {round(rix_score, 1)} indikerer mange lange ord.",
                "suggestion": "Reduser antall lange ord for å bedre flyten i teksten.",
                "impact": "medium",
                "examples": [
                    "Bruk kortere alternativer: 'anvende' → 'bruke'",
                    "Varier mellom korte og lange ord for bedre rytme"
                ]
            })
        
        # Positive feedback for already readable text
        if not recommendations:
            if lix_score < 30:
                recommendations.append({
                    "type": "positive_feedback",
                    "title": "Utmerket lesbarhet",
                    "description": f"Teksten har en LIX-score på {round(lix_score, 1)}, som indikerer svært god lesbarhet.",
                    "suggestion": "Teksten er allerede svært lettlest og tilgjengelig for de fleste lesere.",
                    "impact": "low",
                    "examples": []
                })
            else:
                recommendations.append({
                    "type": "positive_feedback",
                    "title": "God lesbarhet",
                    "description": f"Teksten har en LIX-score på {round(lix_score, 1)}, som indikerer god lesbarhet.",
                    "suggestion": "Teksten har god balanse mellom setningslengde og ordvalg.",
                    "impact": "low",
                    "examples": []
                })
        
        return recommendations