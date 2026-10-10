"""Stages 2-9, 11, 12 of the pipeline. Pure Python, no external dependencies.
Safety principle: NEVER diagnoses or recommends treatment.
It collects symptoms, finds protocol gaps, scores priority with explanations,
and hands off to nurses, who make every final decision.
"""
import re
from datetime import datetime, timedelta, timezone

TIERS = ["stable", "concerning", "urgent", "critical"]
SOURCE_WEIGHT = {
    "patient": 1.0,
    "paramedic": 0.95,
    "community_health_worker": 0.9,
    "relative": 0.85,
}

LEXICON = {
    "chest pain": ["chest pain", "chest tightness", "pressure in chest", "pain in my chest", "chest discomfort"],
    "shortness of breath": [
        "short of breath", "breathless", "difficulty breathing", "can't breathe",
        "cannot breathe", "breathing difficulty", "dyspnea", "gasping", "cannot speak a full"
    ],
    "fever": ["fever", "feverish", "high temperature"],
    "vomiting": ["vomit", "vomiting", "throwing up", "threw up"],
    "dizziness": ["dizzy", "dizziness", "lightheaded", "feeling faint"],
    "sweating": ["sweating", "sweat", "diaphoresis", "cold sweats"],
    "headache": ["headache", "head pain", "severe head"],
    "bleeding": ["bleeding", "blood loss", "bleed", "bleeding from"],
    "abdominal pain": ["stomach pain", "abdominal pain", "belly pain", "tummy pain"],
    "weakness": ["weakness", "weak on", "numb", "numbness"],
    "facial droop": ["face droop", "drooping", "face is crooked", "mouth drooping"],
    "slurred speech": ["slurred", "can't speak properly", "speech unclear"],
    "seizure": ["seizure", "convulsion", "fits"],
    "unconscious": ["unconscious", "unresponsive", "fainted", "passed out", "not waking", "blacked out"],
    "injury": ["fell", "accident", "fracture", "crash", "hit by", "injury", "trauma"],
    "cough": ["cough", "coughing"],
    "rash": ["rash", "skin eruption"],
    "diarrhea": ["diarrhea", "loose motion", "watery stool"],
    "jaw pain": ["jaw", "jaw pain", "lower jaw"],
    "arm pain": ["left arm", "arm pain", "radiating to arm", "radiating to left arm"],
}

PROTOCOL_GAPS = {
    "chest pain": [
        ("radiation", ["radiat", "jaw", "arm", "back"], "Does the pain spread anywhere, like your arm, jaw or back?"),
        ("sweating", ["sweat"], "Are you sweating or feeling clammy?"),
        ("dyspnea", ["breath"], "Are you having any trouble breathing?"),
        ("onset", ["ago", "since", "started", "morning", "night"], "When exactly did the pain start?"),
    ],
    "fever": [
        ("duration", ["day", "hour", "since", "ago"], "How long has the fever been there?"),
        ("age", ["year", "month", "old"], "How old is the patient?"),
        ("intake", ["drink", "feed", "milk", "eating"], "Is the patient drinking or feeding normally?"),
    ],
    "shortness of breath": [
        ("onset", ["ago", "since", "started"], "When did the breathing trouble begin?"),
        ("speech", ["sentence", "speak"], "Can you speak a full sentence without stopping for breath?"),
    ],
    "injury": [
        ("mechanism", ["fell", "accident", "crash", "hit"], "How did the injury happen?"),
        ("bleeding", ["bleed", "blood"], "Is there any heavy bleeding?"),
        ("consciousness", ["conscious", "faint", "awake"], "Was there any loss of consciousness?"),
    ],
    "headache": [
        ("onset", ["ago", "since", "sudden"], "Did the headache come on suddenly or slowly?"),
    ],
}


# Clinically reviewed 5-7 symptom questions covering primary emergency complaint domains.
# Pre-translated to Telugu, Tamil, Hindi, and Kannada for zero-latency presentation in patient's tongue.
SYMPTOM_QUESTION_TEMPLATES: dict[str, list[dict]] = {
    "headache": [
        {
            "id": "q_headache_thunderclap",
            "text_en": "Did your headache begin suddenly and become extremely severe within seconds (like a thunderclap)?",
            "text_te": "మీ తలనొప్పి అకస్మాత్తుగా ప్రారంభమై కొద్ది సెకన్లలోనే విపరీతంగా తీవ్రమైందా?",
            "text_ta": "உங்கள் தலைவலி திடீரென்று தொடங்கி சில வினாடிகளில் மிகவும் கடுமையானதா?",
            "text_hi": "क्या आपका सिरदर्द अचानक शुरू हुआ और कुछ ही सेकंड में बहुत गंभीर हो गया?",
            "text_kn": "ನಿಮ್ಮ ತಲೆನೋವು ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಪ್ರಾರಂಭವಾಗಿ ಕೆಲವೇ ಸೆಕೆಂಡುಗಳಲ್ಲಿ ತೀವ್ರವಾಯಿತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Sudden thunderclap headache onset — potential intracranial hemorrhage/subarachnoid bleed",
            "category": "headache",
        },
        {
            "id": "q_headache_fever",
            "text_en": "Do you have a high fever or stiff neck along with the headache?",
            "text_te": "తలనొప్పితో పాటు తీవ్ర జ్వరం లేదా మెడ పట్టేయడం (స్టిఫ్ నెక్) ఉందా?",
            "text_ta": "தலைவலியுடன் அதிக காய்ச்சல் அல்லது கழுத்து விறைப்பு உள்ளதா?",
            "text_hi": "क्या सिरदर्द के साथ तेज बुखार या गर्दन में अकड़न है?",
            "text_kn": "ತಲೆನೋವಿನೊಂದಿಗೆ ತೀವ್ರ ಜ್ವರ ಅಥವಾ ಕುತ್ತಿಗೆ ಬಿಗಿತವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Headache with fever and neck stiffness — suspected meningitis/encephalitis",
            "category": "headache",
        },
        {
            "id": "q_headache_vision",
            "text_en": "Are you experiencing new vision problems, blurring, or light sensitivity?",
            "text_te": "మీకు కొత్తగా కంటి చూపు మసకబారడం, చూపు తగ్గడం లేదా వెలుతురు చూడలేకపోవడం ఉందా?",
            "text_ta": "புதிய பார்வை மங்கலாகுதல் அல்லது வெளிச்சத்தைப் பார்க்க முடியாத நிலை உள்ளதா?",
            "text_hi": "क्या आपको दृष्टि धुंधली होना या रोशनी से परेशानी महसूस हो रही है?",
            "text_kn": "ಹೊಸದಾಗಿ ದೃಷ್ಟಿ ಮಸುಕಾಗುವುದು ಅಥವಾ ಬೆಳಕಿನ ಸೂಕ್ಷ್ಮತೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "headache",
        },
        {
            "id": "q_headache_neuro",
            "text_en": "Do you have new weakness, numbness, difficulty speaking, or confusion?",
            "text_te": "ఒకవైపు శరీరంలో బలహీనత, తిమ్మిరి, మాట్లాడటంలో ఇబ్బంది లేదా అయోమయం ఉందా?",
            "text_ta": "புதிய பலவீனம், மரத்துப்போதல், பேசுவதில் சிரமம் அல்லது குழப்பம் உள்ளதா?",
            "text_hi": "क्या एक तरफ कमजोरी, सुन्नता, बोलने में कठिनाई या भ्रम महसूस हो रहा है?",
            "text_kn": "ದೇಹದ ಒಂದು ಬದಿಯಲ್ಲಿ ದೌರ್ಬಲ್ಯ, ಮರಗಟ್ಟುವಿಕೆ ಅಥವಾ ಮಾತನಾಡಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Focal neurological deficit with headache — potential acute stroke or space-occupying lesion",
            "category": "headache",
        },
        {
            "id": "q_headache_vomit",
            "text_en": "Have you experienced repeated vomiting since the headache started?",
            "text_te": "తలనొప్పి మొదలైనప్పటి నుండి పదే పదే వాంతులు అవుతున్నాయా?",
            "text_ta": "தலைவலி தொடங்கியதிலிருந்து தொடர்ந்து வாந்தி எடுக்கிறீர்களா?",
            "text_hi": "क्या सिरदर्द शुरू होने के बाद से बार-बार उल्टी हो रही है?",
            "text_kn": "ತಲೆನೋವು ಪ್ರಾರಂಭವಾದಾಗಿನಿಂದ ಪುನರಾವರ್ತಿತ ವಾಂತಿ ಆಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Headache with intractable vomiting — elevated intracranial pressure concern",
            "category": "headache",
        },
        {
            "id": "q_headache_trauma",
            "text_en": "Did this headache begin shortly after a fall, collision, or head injury?",
            "text_te": "ఈ తలనొప్పి పడిపోవడం లేదా తలకు దెబ్బ తగలడం వల్ల ప్రారంభమైందా?",
            "text_ta": "விழுந்ததாலோ அல்லது தலையில் அடிபட்டதாலோ இந்த தலைவலி ஏற்பட்டதா?",
            "text_hi": "क्या यह सिरदर्द गिरने या सिर पर चोट लगने के तुरंत बाद शुरू हुआ?",
            "text_kn": "ಬೀಳುವುದು ಅಥವಾ ತಲೆಗೆ ಪೆಟ್ಟು ಬಿದ್ದ ನಂತರ ಈ ತಲೆನೋವು ಪ್ರಾರಂಭವಾಯಿತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Post-traumatic acute headache — risk of epidural or subdural hematoma",
            "category": "headache",
        },
        {
            "id": "q_headache_novel",
            "text_en": "Is this headache completely new or significantly worse than any headache you've ever had?",
            "text_te": "ఈ తలనొప్పి మీ జీవితంలో ఎప్పుడూ లేనంత తీవ్రంగా లేదా మునుపెన్నడూ రాని కొత్త రకంగా ఉందా?",
            "text_ta": "இதுவரை இல்லாத அளவுக்கு மிகவும் வித்தியாசமான அல்லது மோசமான தலைவலியா?",
            "text_hi": "क्या यह सिरदर्द आपके जीवन में पहले कभी नहीं हुआ या बहुत अलग है?",
            "text_kn": "ಇದುವರೆಗೆ ಎಂದೂ ಅನುಭವಿಸದ ಅತ್ಯಂತ ತೀವ್ರವಾದ ಹೊಸ ತಲೆನೋವೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "headache",
        },
    ],
    "chest pain": [
        {
            "id": "q_chest_radiation",
            "text_en": "Does the pain radiate or spread anywhere, such as your left arm, jaw, neck, or back?",
            "text_te": "ఛాతీ నొప్పి ఎడమ చేతికి, దవడకు, మెడకు లేదా వెనుక వీపుకు వ్యాపిస్తోందా?",
            "text_ta": "நெஞ்சு வலி இடது கை, தாடை, கழுத்து அல்லது முதுகுக்கு பரவுகிறதா?",
            "text_hi": "क्या सीने का दर्द बाएं हाथ, जबड़े, गर्दन या पीठ में फैल रहा है?",
            "text_kn": "ಎದೆ ನೋವು ಎಡ ಭುಜ, ದವಡೆ, ಕುತ್ತಿಗೆ ಅಥವಾ ಬೆನ್ನಿಗೆ ಹರಡುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Radiating chest pain — acute coronary syndrome / myocardial infarction indicator",
            "category": "chest pain",
        },
        {
            "id": "q_chest_sweating",
            "text_en": "Are you experiencing profuse cold sweating, clamminess, or dizziness?",
            "text_te": "మీకు చల్లని చెమటలు ఎక్కువగా పట్టడం లేదా కళ్లు తిరగడం జరుగుతోందా?",
            "text_ta": "அதிகப்படியான குளிர்ந்த வியர்வை அல்லது தலைசுற்றல் உள்ளதா?",
            "text_hi": "क्या आपको अत्यधिक ठंडा पसीना या चक्कर आ रहे हैं?",
            "text_kn": "ಅತಿಯಾಗಿ ತಣ್ಣನೆಯ ಬೆವರು ಬರುತ್ತಿದೆಯೇ ಅಥವಾ ತಲೆತಿರುಗುವಿಕೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Diaphoresis associated with chest discomfort — autonomic response to acute ischemia",
            "category": "chest pain",
        },
        {
            "id": "q_chest_dyspnea",
            "text_en": "Are you having difficulty breathing or shortness of breath?",
            "text_te": "శ్వాస తీసుకోవడంలో తీవ్రమైన కష్టం లేదా ఊపిరాడకపోవడం ఉందా?",
            "text_ta": "மூச்சு விடுவதில் கடுமையான சிரமம் அல்லது மூச்சுத்திணறல் உள்ளதா?",
            "text_hi": "क्या आपको सांस लेने में तकलीफ या दम घुटने जैसा महसूस हो रहा है?",
            "text_kn": "ಉಸಿರಾಟದಲ್ಲಿ ತೊಂದರೆ ಅಥವಾ ಉಸಿರು ಕಟ್ಟುವ ಅನುಭವವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Dyspnea accompanying chest pain — cardiac insufficiency or pulmonary embolism concern",
            "category": "chest pain",
        },
        {
            "id": "q_chest_exertion",
            "text_en": "Does the pain get significantly worse with physical exertion or walking?",
            "text_te": "నడవడం లేదా కొద్దిపాటి శ్రమతో ఛాతీ నొప్పి మరింత ఎక్కువవుతోందా?",
            "text_ta": "நடக்கும்போது அல்லது உழைக்கும்போது வலி அதிகமாகிறதா?",
            "text_hi": "क्या चलने या परिश्रम करने पर दर्द काफी बढ़ जाता है?",
            "text_kn": "ನಡೆಯುವಾಗ ಅಥವಾ ಆಯಾಸಗೊಂಡಾಗ ನೋವು ಗಮನಾರ್ಹವಾಗಿ ಹೆಚ್ಚಾಗುತ್ತದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "chest pain",
        },
        {
            "id": "q_chest_sudden_onset",
            "text_en": "Did this chest pain start suddenly within the last 60 minutes?",
            "text_te": "ఈ నొప్పి గత ఒక గంటలోపే అకస్మాత్తుగా మొదలైందా?",
            "text_ta": "இந்த வலி கடந்த ஒரு மணி நேரத்திற்குள் திடீரென தொடங்கியதா?",
            "text_hi": "क्या यह दर्द पिछले 60 मिनट में अचानक शुरू हुआ?",
            "text_kn": "ಈ ನೋವು ಕಳೆದ 60 ನಿಮಿಷಗಳಲ್ಲಿ ಹಠಾತ್ತಾಗಿ ಪ್ರಾರಂಭವಾಯಿತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Acute hyperacute chest pain onset (<60m) — urgent window for coronary reperfusion",
            "category": "chest pain",
        },
        {
            "id": "q_chest_nausea",
            "text_en": "Do you feel nauseous, sick to your stomach, or have you vomited?",
            "text_te": "కడుపులో తిప్పినట్లు, వికారం లేదా వాంతి వచ్చినట్లు అనిపిస్తోందా?",
            "text_ta": "குமட்டல் அல்லது வாந்தி எடுக்கும் உணர்வு உள்ளதா?",
            "text_hi": "क्या आपको जी मिचलाना या उल्टी जैसा महसूस हो रहा है?",
            "text_kn": "ವಾಕರಿಕೆ ಅಥವಾ ವಾಂತಿ ಮಾಡುವ ಅನುಭವವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "chest pain",
        },
        {
            "id": "q_chest_history",
            "text_en": "Have you ever had a previous heart attack, stent, or cardiac surgery?",
            "text_te": "గతంలో మీకు గుండె జబ్బు, గుండెపోటు రావడం లేదా స్టెంట్ వేయించుకున్నారా?",
            "text_ta": "முன்பு இதய நோய், மாரடைப்பு அல்லது ஸ்டென்ட் வைக்கப்பட்ட வரலாறு உள்ளதா?",
            "text_hi": "क्या आपको पहले से दिल की बीमारी, हार्ट अटैक या स्टेंट लगा होने का इतिहास है?",
            "text_kn": "ಹಿಂದೆ ಹೃದಯ ಕಾಯಿಲೆ, ಹೃದಯಾಘಾತ ಅಥವಾ ಸ್ಟೆಂಟ್ ಅಳವಡಿಸಿದ ಇತಿಹಾಸವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Established cardiovascular history increases risk of recurrent coronary event",
            "category": "chest pain",
        },
    ],
    "shortness of breath": [
        {
            "id": "q_sob_speech",
            "text_en": "Are you struggling to speak a full sentence without stopping for breath?",
            "text_te": "ఊపిరి ఆపుకోలేక పూర్తి వాక్యం మాట్లాడటం కూడా కష్టమవుతోందా?",
            "text_ta": "மூச்சு வாங்காமல் ஒரு முழு வாக்கியத்தை கூட பேச முடியாத அளவுக்கு சிரமமா?",
            "text_hi": "क्या आप सांस लिए बिना एक पूरा वाक्य भी नहीं बोल पा रहे हैं?",
            "text_kn": "ಉಸಿರೆಳೆದುಕೊಳ್ಳದೆ ಒಂದು ಪೂರ್ಣ ವಾಕ್ಯವನ್ನೂ ಮಾತನಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲವೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Speech compromised by dyspnea — critical respiratory compromise requiring immediate airway support",
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_sudden",
            "text_en": "Did your breathing difficulty start suddenly and rapidly worsen?",
            "text_te": "శ్వాస తీసుకోవడంలో ఇబ్బంది అకస్మాత్తుగా ప్రారంభమై వేగంగా తీవ్రమైందా?",
            "text_ta": "மூச்சுத்திணறல் திடீரென்று தொடங்கி வேகமாக மோசமடைந்ததா?",
            "text_hi": "क्या सांस लेने में तकलीफ अचानक शुरू हुई और तेजी से बढ़ी?",
            "text_kn": "ಉಸಿರಾಟದ ತೊಂದರೆ ಹಠಾತ್ತಾಗಿ ಪ್ರಾರಂಭವಾಗಿ ವೇಗವಾಗಿ ಉಲ್ಬಣಗೊಂಡಿತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Acute sudden-onset dyspnea — risk of pulmonary embolism, pneumothorax, or acute pulmonary edema",
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_chest_tight",
            "text_en": "Do you also feel chest tightness, crushing pressure, or chest pain?",
            "text_te": "ఛాతీ బిగించినట్లు, బరువుగా లేదా ఛాతీలో నొప్పి కూడా ఉందా?",
            "text_ta": "நெஞ்சு இறுக்கம், கனமான அழுத்தம் அல்லது வலியும் உள்ளதா?",
            "text_hi": "क्या सीने में भारीपन, जकड़न या दर्द भी महसूस हो रहा है?",
            "text_kn": "ಎದೆಯಲ್ಲಿ ಬಿಗಿತ, ಅತಿಯಾದ ಒತ್ತಡ ಅಥವಾ ನೋವು ಕೂಡ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Dyspnea combined with chest tightness — potential cardiopulmonary emergency",
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_wheeze",
            "text_en": "Do you hear whistling or wheezing sounds when breathing in or out?",
            "text_te": "ఊపిరి పీలుస్తున్నప్పుడు లేదా వదులుతున్నప్పుడు పిల్లికూతలు (వీజింగ్) వినిపిస్తున్నాయా?",
            "text_ta": "மூச்சு விடும்போது விசில் சத்தம் அல்லது இழுப்பு உள்ளதா?",
            "text_hi": "क्या सांस लेते समय सीटी जैसी आवाज (घरघराहट) आ रही है?",
            "text_kn": "ಉಸಿರಾಡುವಾಗ ಸಿಳ್ಳೆ ಹೊಡೆಯುವಂತಹ ಶಬ್ದ (ವೀಸಿಂಗ್) ಕೇಳಿಸುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_cyanosis",
            "text_en": "Do your lips, fingernails, or skin look pale or bluish?",
            "text_te": "మీ పెదవులు లేదా గోళ్లు పాలిపోయినట్లు లేదా నీలంగా మారినట్లు కనిపిస్తున్నాయా?",
            "text_ta": "உதடுகள் அல்லது விரல் நகங்கள் நீல நிறமாக அல்லது வெளிறிப் போயுள்ளதா?",
            "text_hi": "क्या आपके होंठ या नाखून नीले या फीके पड़ रहे हैं?",
            "text_kn": "ತುಟಿಗಳು ಅಥವಾ ಬೆರಳಿನ ಉಗುರುಗಳು ನೀಲಿ ಬಣ್ಣಕ್ಕೆ ತಿರುಗಿವೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Peripheral or central cyanosis — severe hypoxemia alert",
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_cough_fever",
            "text_en": "Do you have a persistent cough, fever, or swelling in your feet?",
            "text_te": "ఎడతెగని దగ్గు, జ్వరం లేదా పాదాలలో వాపులు ఉన్నాయా?",
            "text_ta": "தொடர் இருமல், காய்ச்சல் அல்லது கால்களில் வீக்கம் உள்ளதா?",
            "text_hi": "क्या आपको लगातार खांसी, बुखार या पैरों में सूजन है?",
            "text_kn": "ನಿರಂತರ ಕೆಮ್ಮು, ಜ್ವರ ಅಥವಾ ಪಾದಗಳಲ್ಲಿ ಊತವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "shortness of breath",
        },
        {
            "id": "q_sob_history",
            "text_en": "Do you have a known history of asthma, COPD, or congestive heart failure?",
            "text_te": "గతంలో ఆస్తమా, ఊపిరితిత్తుల సమస్య లేదా గుండె జబ్బు ఉన్నట్లు నిర్ధారించబడిందా?",
            "text_ta": "முன்பே ஆஸ்துமா, நுரையீரல் நோய் அல்லது இதய செயலிழப்பு வரலாறு உள்ளதா?",
            "text_hi": "क्या आपको अस्थमा, फेफड़ों की बीमारी या दिल की विफलता का पुराना इतिहास है?",
            "text_kn": "ಹಿಂದೆ ಆಸ್ತಮಾ, ಶ್ವಾಸಕೋಶದ ಕಾಯಿಲೆ ಅಥವಾ ಹೃದಯ ಸಮಸ್ಯೆ ಇತ್ತೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "shortness of breath",
        },
    ],
    "abdominal pain": [
        {
            "id": "q_abdo_severity",
            "text_en": "Is the abdominal pain severe, sharp, or rapidly getting worse right now?",
            "text_te": "కడుపు నొప్పి చాలా తీవ్రంగా, పొడిచినట్లుగా లేదా వేగంగా ఎక్కువవుతోందా?",
            "text_ta": "வயிற்று வலி மிகவும் கடுமையானதாக, குத்துவது போல் உள்ளதா?",
            "text_hi": "क्या पेट का दर्द बहुत तेज, चुभने वाला या तेजी से बढ़ रहा है?",
            "text_kn": "ಹೊಟ್ಟೆ ನೋವು ಅತ್ಯಂತ ತೀವ್ರವಾಗಿ, ಚುಚ್ಚುವಂತೆ ವೇಗವಾಗಿ ಉಲ್ಬಣಗೊಳ್ಳುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Acute abdomen presentation — surgical abdomen or perforation risk",
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_rigid",
            "text_en": "Is your belly rock-hard, rigid, or too painful to even gently touch?",
            "text_te": "మీ పొట్ట బండలా గట్టిపడిపోయి, తాకడానికి కూడా వీలులేనంత తీవ్రంగా నొప్పిగా ఉందా?",
            "text_ta": "வயிறு கல்லு போல் இறுகிப்போய் தொட்டாலே தாங்க முடியாத வலி உள்ளதா?",
            "text_hi": "क्या आपका पेट सख्त या छूने पर अत्यधिक दर्दनाक है?",
            "text_kn": "ಹೊಟ್ಟೆಯು ಬಂಡೆಯಂತೆ ಗಟ್ಟಿಯಾಗಿದೆಯೇ ಮತ್ತು ಮುಟ್ಟಿದರೆ ಅಸಹನೀಯ ನೋವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Involuntary guarding / board-like rigidity — peritonitis danger sign",
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_blood",
            "text_en": "Have you vomited blood or noticed dark, black, or bloody stools?",
            "text_te": "వాంతిలో రక్తం పడటం లేదా మలంలో రక్తం / నల్లటి మలం రావడం జరిగిందా?",
            "text_ta": "வாந்தியில் ரத்தம் வந்ததா அல்லது கருப்பு நிற மலம் கழித்தீர்களா?",
            "text_hi": "क्या उल्टी में खून आया है या काला/खूनी मल आ रहा है?",
            "text_kn": "ವಾಂತಿಯಲ್ಲಿ ರಕ್ತ ಬಂದಿದೆಯೇ ಅಥವಾ ಕಪ್ಪು ಬಣ್ಣದ ಮಲ ವಿಸರ್ಜನೆಯಾಗಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Upper or lower gastrointestinal hemorrhage detected",
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_vomit",
            "text_en": "Have you had repeated vomiting and are unable to keep any fluids down?",
            "text_te": "పదే పదే వాంతులు అవుతూ, నీళ్లు కూడా తాగలేని పరిస్థితి ఉందా?",
            "text_ta": "தொடர்ந்து வாந்தி எடுத்து தண்ணீர் கூட குடிக்க முடியாத நிலை உள்ளதா?",
            "text_hi": "क्या लगातार उल्टी हो रही है और पानी भी नहीं पच रहा है?",
            "text_kn": "ಪುನರಾವರ್ತಿತ ವಾಂತಿ ಆಗುತ್ತಿದ್ದು, ನೀರು ಕೂಡ ಕುಡಿಯಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲವೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_fever",
            "text_en": "Do you have a fever, chills, or jaundice (yellow eyes/skin)?",
            "text_te": "జ్వరం, వణుకు లేదా కళ్లు/చర్మం పచ్చబడటం (కామెర్లు) ఉన్నాయా?",
            "text_ta": "காய்ச்சல், நடுக்கம் அல்லது கண்கள்/தோல் மஞ்சளாகியுள்ளதா?",
            "text_hi": "क्या बुखार, कंपकंपी या आंखें/त्वचा पीली (पीलिया) पड़ रही हैं?",
            "text_kn": "ಜ್ವರ, ಚಳಿ ಅಥವಾ ಕಣ್ಣು/ಚರ್ಮ ಹಳದಿಯಾಗಿದೆಯೇ (ಕಾಮಾಲೆ)?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_bowel",
            "text_en": "Are you unable to pass gas or have a bowel movement?",
            "text_te": "గ్యాస్ పోవడం లేదా మలవిసర్జన జరగడం పూర్తిగా ఆగిపోయిందా?",
            "text_ta": "காற்று பிரிதல் அல்லது மலம் கழித்தல் முற்றிலும் நின்றுவிட்டதா?",
            "text_hi": "क्या गैस पास होना या शौच जाना पूरी तरह बंद हो गया है?",
            "text_kn": "ಗ್ಯಾಸ್ ಹೋಗುವುದು ಅಥವಾ ಮಲವಿಸರ್ಜನೆ ಸಂಪೂರ್ಣವಾಗಿ ನಿಂತುಹೋಗಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "abdominal pain",
        },
        {
            "id": "q_abdo_pregnancy",
            "text_en": "If applicable: is there any possibility of current pregnancy?",
            "text_te": "వర్తిస్తే: గర్భం దాల్చే అవకాశం ఏమైనా ఉందా?",
            "text_ta": "பொருந்தினால்: கர்ப்பமாக இருப்பதற்கான வாய்ப்பு ஏதேனும் உள்ளதா?",
            "text_hi": "यदि लागू हो: क्या गर्भावस्था की कोई संभावना है?",
            "text_kn": "ಅನ್ವಯಿಸಿದರೆ: ಗರ್ಭಧಾರಣೆಯ ಯಾವುದೇ ಸಾಧ್ಯತೆಯಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "abdominal pain",
        },
    ],
    "fever": [
        {
            "id": "q_fever_duration",
            "text_en": "Has the fever persisted continuously for more than 2 full days?",
            "text_te": "జ్వరం రెండు రోజుల కంటే ఎక్కువ కాలంగా తగ్గకుండా కొనసాగుతోందా?",
            "text_ta": "காய்ச்சல் 2 நாட்களுக்கு மேலாக தொடர்ந்து நீடிக்கிறதா?",
            "text_hi": "क्या बुखार लगातार 2 दिनों से अधिक समय से बना हुआ है?",
            "text_kn": "ಜ್ವರವು 2 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ನಿರಂತರವಾಗಿ ಮುಂದುವರಿದಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "fever",
        },
        {
            "id": "q_fever_chills_confusion",
            "text_en": "Are you experiencing severe shivering chills, confusion, or extreme weakness?",
            "text_te": "తీవ్రమైన చలి వణుకు, అయోమయం లేదా మంచం దిగలేనంత బలహీనత ఉందా?",
            "text_ta": "கடுமையான நடுக்கம், குழப்பம் அல்லது கடுமையான பலவீனம் உள்ளதா?",
            "text_hi": "क्या तेज कंपकंपी, मानसिक भ्रम या अत्यधिक कमजोरी महसूस हो रही है?",
            "text_kn": "ತೀವ್ರ ಚಳಿ, ಗೊಂದಲ ಅಥವಾ ಅತಿಯಾದ ದೌರ್ಬಲ್ಯವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "High fever with rigors or altered mental state — sepsis warning sign",
            "category": "fever",
        },
        {
            "id": "q_fever_rash",
            "text_en": "Do you have a stiff neck or small purple/red spots (rash) on the skin?",
            "text_te": "మెడ పట్టేయడం లేదా చర్మంపై ఎర్రటి/ఊదా రంగు దద్దుర్లు కనిపించాయా?",
            "text_ta": "கழுத்து விறைப்பு அல்லது தோலில் சிறிய சிவப்பு/ஊதா புள்ளிகள் உள்ளதா?",
            "text_hi": "क्या गर्दन में अकड़न या त्वचा पर लाल/बैंगनी चकत्ते हैं?",
            "text_kn": "ಕುತ್ತಿಗೆ ಬಿಗಿತ ಅಥವಾ ಚರ್ಮದ ಮೇಲೆ ಸಣ್ಣ ಕೆಂಪು ಕಲೆಗಳು (ದದ್ದು) ಇವೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Fever with neck stiffness or purpuric rash — acute meningococcal infection risk",
            "category": "fever",
        },
        {
            "id": "q_fever_intake",
            "text_en": "Are you able to drink water and fluids normally without vomiting?",
            "text_te": "వాంతులు కాకుండా మంచి నీళ్లు, ద్రవాలు సరిగ్గా తీసుకోగలుగుతున్నారా?",
            "text_ta": "வாந்தி எடுக்காமல் தண்ணீர் மற்றும் திரவங்களை குடிக்க முடிகிறதா?",
            "text_hi": "क्या आप बिना उल्टी के पानी या तरल पदार्थ सामान्य रूप से ले पा रहे हैं?",
            "text_kn": "ವಾಂತಿ ಮಾಡಿಕೊಳ್ಳದೆ ನೀರು ಮತ್ತು ದ್ರವಾಹಾರವನ್ನು ಸರಿಯಾಗಿ ಸೇವಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "no",
            "red_flag_reason": "Inability to maintain oral hydration during febrile illness — dehydration risk",
            "category": "fever",
        },
        {
            "id": "q_fever_cough_breath",
            "text_en": "Do you have a deep chest cough or difficulty breathing with the fever?",
            "text_te": "జ్వరంతో పాటు తీవ్రమైన దగ్గు లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఉందా?",
            "text_ta": "காய்ச்சலுடன் கடுமையான இருமல் அல்லது மூச்சுத்திணறல் உள்ளதா?",
            "text_hi": "क्या बुखार के साथ तेज खांसी या सांस लेने में तकलीफ है?",
            "text_kn": "ಜ್ವರದೊಂದಿಗೆ ಆಳವಾದ ಎದೆ ಕೆಮ್ಮು ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Fever with acute lower respiratory distress — suspected severe pneumonia",
            "category": "fever",
        },
        {
            "id": "q_fever_pediatric_drowsy",
            "text_en": "For infants or elderly: is the patient unusually floppy, drowsy, or hard to wake up?",
            "text_te": "చిన్న పిల్లలు లేదా వృద్ధులైతే: రోగి అచేతనంగా, నీరసించి లేదా లేపినా లేవని స్థితిలో ఉన్నారా?",
            "text_ta": "குழந்தைகள்/முதியவர்கள்: வழக்கத்திற்கு மாறாக சோர்வாக அல்லது எழுப்ப முடியாத மயக்கத்தில் உள்ளாரா?",
            "text_hi": "बच्चों/बुजुर्गों के लिए: क्या मरीज असामान्य रूप से सुस्त या जगाने में बहुत कठिन है?",
            "text_kn": "ಮಕ್ಕಳು/ಹಿರಿಯರಿಗೆ: ರೋಗಿಯು ಅತಿಯಾಗಿ ಜಡವಾಗಿ ಅಥವಾ ಎಬ್ಬಿಸಲು ಕಷ್ಟವಾಗುವ ಸ್ಥಿತಿಯಲ್ಲಿದ್ದಾರೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Extreme lethargy in vulnerable age extreme with fever — urgent pediatric/geriatric escalation",
            "category": "fever",
        },
    ],
    "dizziness": [
        {
            "id": "q_dizzy_syncope",
            "text_en": "Did you completely lose consciousness, faint, or black out even for a moment?",
            "text_te": "మీరు స్పృహతప్పి పడిపోవడం లేదా కొద్దిసేపు కూడా తెలివి తప్పడం జరిగిందా?",
            "text_ta": "சிறிது நேரமாவது முழுமையாக சுயநினைவை இழந்து மயங்கி விழுந்தீர்களா?",
            "text_hi": "क्या आप पूरी तरह से बेहोश हुए या कुछ पलों के लिए चक्कर खाकर गिरे?",
            "text_kn": "ನೀವು ಪ್ರಜ್ಞೆ ತಪ್ಪಿ ಬಿದ್ದಿರಾ ಅಥವಾ ಸ್ವಲ್ಪ ಸಮಯವಾದರೂ ಅರಿವು ತಪ್ಪಿತ್ತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "True syncope / loss of consciousness — cardiogenic arrhythmia or neurovascular compromise",
            "category": "dizziness",
        },
        {
            "id": "q_dizzy_fast_signs",
            "text_en": "Do you notice any face drooping, slurred speech, or weakness in one arm?",
            "text_te": "ముఖం ఒకవైపు వంకరపోవడం, మాట ముద్దబారడం లేదా ఒక చేయి బలహీనపడటం ఉందా?",
            "text_ta": "முகம் ஒருபக்கம் கோணுதல், பேச்சு குளறுதல் அல்லது ஒரு கையில் பலவீனம் உள்ளதா?",
            "text_hi": "क्या चेहरे का एक तरफ झुकना, बोली लड़खड़ाना या एक हाथ में कमजोरी है?",
            "text_kn": "ಮುಖದ ಒಂದು ಬದಿ ವಕ್ರವಾಗುವುದು, ಮಾತು ಅಸ್ಪಷ್ಟವಾಗುವುದು ಅಥವಾ ಒಂದು ತೋಳಿನಲ್ಲಿ ದೌರ್ಬಲ್ಯವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Positive FAST stroke warning signs — immediate stroke code protocol",
            "category": "dizziness",
        },
        {
            "id": "q_dizzy_chest_pain",
            "text_en": "Do you have chest pain, chest fluttering (palpitations), or shortness of breath?",
            "text_te": "ఛాతీలో నొప్పి, గుండె వేగంగా కొట్టుకోవడం (దడ) లేదా శ్వాస ఆడకపోవడం ఉందా?",
            "text_ta": "நெஞ்சு வலி, படபடப்பு அல்லது மூச்சுத்திணறல் உள்ளதா?",
            "text_hi": "क्या सीने में दर्द, तेज धड़कन (घबराहट) या सांस फूलना महसूस हो रहा है?",
            "text_kn": "ಎದೆ ನೋವು, ಎದೆ ಬಡಿತ ವೇಗವಾಗುವುದು ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Dizziness accompanied by chest pain or palpitations — hemodynamic or arrhythmia danger",
            "category": "dizziness",
        },
        {
            "id": "q_dizzy_spinning",
            "text_en": "Does the room feel like it is continuously spinning around you (vertigo)?",
            "text_te": "మీ చుట్టూ ఉన్న గది మొత్తం గిర్రున తిరుగుతున్నట్లు అనిపిస్తోందా (వెర్టిగో)?",
            "text_ta": "உங்களைச் சுற்றியுள்ள அறை சுற்றுவது போல் சுழலுகிறதா?",
            "text_hi": "क्या ऐसा लग रहा है कि कमरा आपके चारों ओर घूम रहा है (चक्कर आना)?",
            "text_kn": "ಕೋಣೆಯೇ ನಿಮ್ಮ ಸುತ್ತ ಗಿರಗನೆ ತಿರುಗುತ್ತಿರುವಂತೆ ಭಾಸವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "dizziness",
        },
        {
            "id": "q_dizzy_melena",
            "text_en": "Have you had black tarry stools or signs of unusual bleeding?",
            "text_te": "నల్లటి మలం రావడం లేదా అసాధారణ రక్తస్రావం కనిపించిందా?",
            "text_ta": "கருப்பு நிற மலம் அல்லது வழக்கத்திற்கு மாறான ரத்தப்போக்கு உள்ளதா?",
            "text_hi": "क्या काला मल या कोई असामान्य रक्तस्राव हुआ है?",
            "text_kn": "ಕಪ್ಪು ಬಣ್ಣದ ಮಲ ಅಥವಾ ರಕ್ತಸ್ರಾವದ ಲಕ್ಷಣಗಳಿವೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Occult blood loss causing orthostatic presyncope / severe anemia",
            "category": "dizziness",
        },
        {
            "id": "q_dizzy_hydration",
            "text_en": "Have you had very little water intake, vomiting, or severe diarrhea today?",
            "text_te": "ఈ రోజు నీళ్లు సరిగ్గా తాగకపోవడం, వాంతులు లేదా విరేచనాలు ఎక్కువగా అయ్యాయా?",
            "text_ta": "இன்று மிகக் குறைந்த தண்ணீர் குடித்தீர்களா, வாந்தி அல்லது வயிற்றுப்போக்கு உள்ளதா?",
            "text_hi": "क्या आज बहुत कम पानी पिया है या उल्टी/दस्त हुए हैं?",
            "text_kn": "ಇಂದು ಕಡಿಮೆ ನೀರು ಕುಡಿದಿದ್ದೀರಾ ಅಥವಾ ವಾಂತಿ/ಅತಿಸಾರವಾಗಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "dizziness",
        },
    ],
    "injury": [
        {
            "id": "q_injury_loc",
            "text_en": "Did you hit your head or lose consciousness, even briefly, during the accident?",
            "text_te": "ప్రమాద సమయంలో తలకు దెబ్బ తగలడం లేదా కొద్దిసేపైనా స్పృహ కోల్పోవడం జరిగిందా?",
            "text_ta": "விபத்தின் போது தலையில் அடிபட்டதா அல்லது சிறிது நேரமாவது மயக்கமடைந்தீர்களா?",
            "text_hi": "क्या दुर्घटना में सिर पर चोट लगी या थोड़ी देर के लिए भी बेहोश हुए?",
            "text_kn": "ಅಪಘಾತದ ಸಮಯದಲ್ಲಿ ತಲೆಗೆ ಪೆಟ್ಟು ಬಿದ್ದಿತ್ತೇ ಅಥವಾ ಪ್ರಜ್ಞೆ ತಪ್ಪಿತ್ತೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Head trauma with loss of consciousness — intracranial injury protocol required",
            "category": "injury",
        },
        {
            "id": "q_injury_bleed",
            "text_en": "Is there active or heavy bleeding that does not stop with direct pressure?",
            "text_te": "ఒత్తిడి పెట్టినా కూడా ఆగకుండా రక్తం ఎక్కువగా కారుతోందా?",
            "text_ta": "அழுத்திப் பிடித்தாலும் நிற்காமல் அதிகப்படியான ரத்தப்போக்கு உள்ளதா?",
            "text_hi": "क्या दबाव डालने के बाद भी बहुत ज्यादा खून बहना बंद नहीं हो रहा है?",
            "text_kn": "ಒತ್ತಿ ಹಿಡಿದರೂ ನಿಲ್ಲದ ರಕ್ತಸ್ರಾವವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Uncontrolled hemorrhage — urgent hemostatic intervention needed",
            "category": "injury",
        },
        {
            "id": "q_injury_neck_spine",
            "text_en": "Do you have severe neck or spine pain, or numbness/tingling in both arms or legs?",
            "text_te": "మెడ లేదా వెన్నెముకలో తీవ్రమైన నొప్పి, చేతులు లేదా కాళ్ళలో స్పర్శ కోల్పోవడం ఉందా?",
            "text_ta": "கழுத்து அல்லது முதுகெலும்பில் கடுமையான வலி, அல்லது கை கால்களில் மரத்துப்போதல் உள்ளதா?",
            "text_hi": "क्या गर्दन या रीढ़ में तेज दर्द है, या दोनों हाथों/पैरों में झुनझुनी/सुन्नता है?",
            "text_kn": "ಕುತ್ತಿಗೆ ಅಥವಾ ಬೆನ್ನುಮೂಳೆಯಲ್ಲಿ ತೀವ್ರ ನೋವು ಅಥವಾ ಕೈಕಾಲುಗಳಲ್ಲಿ ಮರಗಟ್ಟುವಿಕೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Potential cervical spine or spinal cord injury — maintain strict spinal precautions",
            "category": "injury",
        },
        {
            "id": "q_injury_deformity",
            "text_en": "Is there visible bone deformity or are you unable to move or bear weight on the limb?",
            "text_te": "ఎముక వంకరపోవడం లేదా ఆ భాగాన్ని కదల్చలేకపోవడం / నిలబడలేకపోవడం ఉందా?",
            "text_ta": "எலும்பு வளைந்துள்ளதா அல்லது காலில் நிற்க/அசைக்க முடியாத நிலை உள்ளதா?",
            "text_hi": "क्या हड्डी टेढ़ी दिख रही है या आप अंग को हिलाने/वजन डालने में असमर्थ हैं?",
            "text_kn": "ಮೂಳೆ ವಕ್ರವಾಗಿದೆಯೇ ಅಥವಾ ಆ ಭಾಗವನ್ನು ಚಲಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲವೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "injury",
        },
        {
            "id": "q_injury_distal_pulse",
            "text_en": "Does the injured hand or foot feel extremely cold, pale, or completely numb?",
            "text_te": "గాయపడిన చేయి లేదా కాలు మంచులా చల్లబడిపోయిందా, లేదా పూర్తిగా తిమ్మిరెక్కిపోయిందా?",
            "text_ta": "காயமடைந்த கை அல்லது கால் மிகவும் குளிர்ந்து, வெளிறி, உணர்விழந்து காணப்படுகிறதா?",
            "text_hi": "क्या घायल हाथ या पैर बहुत ठंडा, फीका या पूरी तरह सुन्न लग रहा है?",
            "text_kn": "ಪೆಟ್ಟಾದ ಕೈ ಅಥವಾ ಕಾಲು ಅತಿಯಾಗಿ ತಣ್ಣಗಾಗಿದೆಯೇ ಅಥವಾ ಮರಗಟ್ಟಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Loss of distal sensation/perfusion — potential acute vascular compromise",
            "category": "injury",
        },
        {
            "id": "q_injury_breathing",
            "text_en": "Was your chest or abdomen crushed or hit hard, making breathing painful?",
            "text_te": "ఛాతీ లేదా పొట్టపై బలంగా దెబ్బ తగిలి, శ్వాస తీసుకోవడం కష్టంగా మారిందా?",
            "text_ta": "நெஞ்சு அல்லது வயிற்றில் பலத்த அடிபட்டு மூச்சு விடுவது வலியாக உள்ளதா?",
            "text_hi": "क्या सीने या पेट पर जोरदार चोट लगी है जिससे सांस लेने में दर्द हो रहा है?",
            "text_kn": "ಎದೆ ಅಥವಾ ಹೊಟ್ಟೆಗೆ ಬಲವಾಗಿ ಪೆಟ್ಟು ಬಿದ್ದು ಉಸಿರಾಡಲು ನೋವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Blunt chest/abdominal trauma with respiratory pain — risk of hemothorax/internal organ injury",
            "category": "injury",
        },
    ],
    "general": [
        {
            "id": "q_gen_sudden",
            "text_en": "Did your symptom begin suddenly and reach peak intensity very quickly?",
            "text_te": "మీ సమస్య అకస్మాత్తుగా మొదలై చాలా త్వరగా తీవ్ర స్థాయికి చేరుకుందా?",
            "text_ta": "உங்கள் பிரச்சனை திடீரென்று தொடங்கி மிக வேகமாக உச்சத்தை அடைந்ததா?",
            "text_hi": "क्या आपकी समस्या अचानक शुरू हुई और बहुत जल्दी गंभीर हो गई?",
            "text_kn": "ನಿಮ್ಮ ತೊಂದರೆ ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಪ್ರಾರಂಭವಾಗಿ ವೇಗವಾಗಿ ಉಲ್ಬಣಗೊಂಡಿತೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "general",
        },
        {
            "id": "q_gen_worsening",
            "text_en": "Is the condition getting progressively worse right now rather than improving?",
            "text_te": "ఈ సమస్య ఇప్పుడు నయం కావడం కంటే మరింతగా ముదురుతోందా?",
            "text_ta": "இந்த நிலை தற்போது சரியாவதற்கு பதிலாக மேலும் மோசமாகிக் கொண்டிருக்கிறதா?",
            "text_hi": "क्या स्थिति सुधरने के बजाय लगातार बिगड़ती जा रही है?",
            "text_kn": "ಪರಿಸ್ಥಿತಿಯು ಸುಧಾರಿಸುವ ಬದಲು ಸದ್ಯಕ್ಕೆ ಉಲ್ಬಣಗೊಳ್ಳುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "general",
        },
        {
            "id": "q_gen_breathing",
            "text_en": "Are you having any difficulty breathing or feeling breathless?",
            "text_te": "మీకు ఏదైనా శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా ఊపిరాడకపోవడం ఉందా?",
            "text_ta": "மூச்சு விடுவதில் ஏதேனும் சிரமம் அல்லது மூச்சுத்திணறல் உள்ளதா?",
            "text_hi": "क्या आपको सांस लेने में कोई कठिनाई या सांस फूलने का अहसास है?",
            "text_kn": "ಉಸಿರಾಟದಲ್ಲಿ ಯಾವುದೇ ತೊಂದರೆ ಅಥವಾ ಉಸಿರು ಕಟ್ಟುವಿಕೆ ಇದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Associated respiratory distress in acute presentation",
            "category": "general",
        },
        {
            "id": "q_gen_chest_pain",
            "text_en": "Are you experiencing any chest discomfort, tightness, or radiating pain?",
            "text_te": "ఛాతీలో అసౌకర్యం, బిగుతుగా ఉండటం లేదా నొప్పి వ్యాపించడం లాంటివి ఏమైనా ఉన్నాయా?",
            "text_ta": "நெஞ்சு பகுதியில் அசௌகரியம், இறுக்கம் அல்லது வலி உள்ளதா?",
            "text_hi": "क्या सीने में कोई बेचैनी, जकड़न या दर्द का अहसास है?",
            "text_kn": "ಎದೆಯಲ್ಲಿ ಯಾವುದೇ ಅಸ್ವಸ್ಥತೆ, ಬಿಗಿತ ಅಥವಾ ನೋವಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Occult chest discomfort present with systemic complaint",
            "category": "general",
        },
        {
            "id": "q_gen_alertness",
            "text_en": "Are you feeling lightheaded, very faint, or having trouble staying awake?",
            "text_te": "కళ్లు తిరగడం, స్పృహ తప్పుతున్నట్లు అనిపించడం లేదా మెలకువగా ఉండటం కష్టంగా ఉందా?",
            "text_ta": "தலைசுற்றல், மயக்கம் வருவது போன்ற உணர்வு அல்லது விழித்திருக்க முடியாத நிலை உள்ளதா?",
            "text_hi": "क्या बहुत ज्यादा चक्कर आ रहे हैं या होश में रहने में कठिनाई हो रही है?",
            "text_kn": "ತಲೆತಿರುಗುವಿಕೆ, ಮಂಪರು ಅಥವಾ ಎಚ್ಚರವಾಗಿರಲು ಕಷ್ಟವಾಗುತ್ತಿದೆಯೇ?",
            "type": "yes_no",
            "red_flag_if": "yes",
            "red_flag_reason": "Impaired alertness or presyncope in acute presentation",
            "category": "general",
        },
        {
            "id": "q_gen_history",
            "text_en": "Have you ever had this exact medical issue before in the past?",
            "text_te": "గతంలో కూడా మీకు ఇదే రకమైన అనారోగ్య సమస్య ఎప్పుడైనా వచ్చిందా?",
            "text_ta": "கடந்த காலத்தில் இதே போன்ற பிரச்சனை உங்களுக்கு ஏற்பட்டிருக்கிறதா?",
            "text_hi": "क्या आपको अतीत में पहले कभी बिल्कुल यही समस्या हुई है?",
            "text_kn": "ಹಿಂದೆ ಎಂದಾದರೂ ನಿಮಗೆ ಇದೇ ರೀತಿಯ ಸಮಸ್ಯೆ ಉಂಟಾಗಿತ್ತೇ?",
            "type": "yes_no",
            "red_flag_if": None,
            "red_flag_reason": None,
            "category": "general",
        },
    ],
}


def generate_symptom_questionnaire(chief_complaint: str, entities: dict | None = None, language: str = "en") -> list[dict]:
    """Generates a batch of 5-7 clinically relevant symptom questions adapted to the patient's complaint.
    Uses regional-language templates with fallback translation.
    """
    e = entities or {}
    symptoms = [s.lower() for s in e.get("symptoms", [])]
    chief = (chief_complaint or e.get("chief_complaint") or "").lower()
    
    # 1. Determine clinical complaint category
    cat = "general"
    if "headache" in chief or any("headache" in s for s in symptoms):
        cat = "headache"
    elif "chest" in chief or any("chest" in s for s in symptoms):
        cat = "chest pain"
    elif any(k in chief or any(k in s for s in symptoms) for k in ("breath", "dyspnea", "short of breath", "gasp")):
        cat = "shortness of breath"
    elif any(k in chief or any(k in s for s in symptoms) for k in ("stomach", "abdomen", "belly", "abdominal")):
        cat = "abdominal pain"
    elif any(k in chief or any(k in s for s in symptoms) for k in ("fever", "temperature", "chills")):
        cat = "fever"
    elif any(k in chief or any(k in s for s in symptoms) for k in ("dizzy", "dizziness", "faint", "spinning", "lightheaded")):
        cat = "dizziness"
    elif any(k in chief or any(k in s for s in symptoms) for k in ("injury", "trauma", "fall", "accident", "crash", "fracture")):
        cat = "injury"

    raw_template = SYMPTOM_QUESTION_TEMPLATES.get(cat, SYMPTOM_QUESTION_TEMPLATES["general"])
    lang_code = language.split("-")[0].lower() if language else "en"

    # 2. Format questions with native translation for patient
    questions = []
    for q in raw_template:
        native_text = q.get(f"text_{lang_code}") or q["text_en"]
        questions.append({
            "id": q["id"],
            "text_en": q["text_en"],
            "text_native": native_text,
            "type": q.get("type", "yes_no"),
            "red_flag_if": q.get("red_flag_if"),
            "red_flag_reason": q.get("red_flag_reason"),
            "category": q.get("category", cat),
            "answer": None,
            "is_answered": False,
        })

    return questions


def evaluate_questionnaire_answers(questions: list[dict], answers: dict) -> dict:
    """Evaluates the patient's answers to the questionnaire.
    Checks for red flags, calculates completion progress, separates explicit negative findings,
    and returns a clinical evaluation structure.
    """
    updated_questions = []
    red_flags = []
    positive_findings = []
    negative_findings = []
    uncertain_findings = []

    for q in questions:
        qid = q["id"]
        ans = answers.get(qid)
        q_copy = dict(q)
        q_copy["answer"] = ans
        q_copy["is_answered"] = ans is not None and str(ans).strip() != ""

        if ans == "yes":
            positive_findings.append(q["text_en"])
            if q.get("red_flag_if") == "yes" and q.get("red_flag_reason"):
                red_flags.append(q["red_flag_reason"])
        elif ans == "no":
            negative_findings.append(q["text_en"])
            if q.get("red_flag_if") == "no" and q.get("red_flag_reason"):
                red_flags.append(q["red_flag_reason"])
        elif ans == "not_sure":
            uncertain_findings.append(q["text_en"])
        elif not q_copy["is_answered"]:
            uncertain_findings.append(f"{q['text_en']} (Unanswered)")

        updated_questions.append(q_copy)

    answered_count = sum(1 for q in updated_questions if q["is_answered"])
    total_count = len(updated_questions)

    return {
        "questions": updated_questions,
        "total_questions": total_count,
        "answered_count": answered_count,
        "unanswered_count": total_count - answered_count,
        "red_flags": red_flags,
        "positive_findings": positive_findings,
        "negative_findings": negative_findings,
        "uncertain_findings": uncertain_findings,
    }


def _has(t: str, kws: list[str]) -> bool:
    return any(k in t for k in kws)


def extract(text: str, prior: dict | None = None) -> dict:
    """Stage 2 clinical extractor.
    Uses GroqCloud LLM (when configured) and augments with deterministic clinical rules.
    Extracts symptoms, severity (1-10), age in years, progression, onset, and aggravating factors.
    """
    # 1. Attempt GroqCloud LLM extraction if configured
    try:
        from backend.app.groq_client import extract_with_groq
        groq_result = extract_with_groq(text, prior)
        if groq_result:
            # Also run deterministic keywords check to ensure known safety-critical terms are captured
            found = [s for s, kws in LEXICON.items() if _has(text.lower(), kws)]
            for s in found:
                if s not in groq_result["symptoms"]:
                    groq_result["symptoms"].append(s)
            if not groq_result.get("chief_complaint") and found:
                groq_result["chief_complaint"] = found[0]
            return groq_result
    except Exception:
        pass

    # 2. Deterministic heuristic extractor fallback
    t = text.lower()
    if prior is None:
        e = {
            "symptoms": [],
            "associated": [],
            "severity": None,
            "age": None,
            "progression": None,
            "onset_text": None,
            "chief_complaint": None,
            "aggravating": [],
            "relieving": [],
        }
    else:
        e = prior

    found = [s for s, kws in LEXICON.items() if _has(t, kws)]
    for s in found:
        if s not in e["symptoms"]:
            e["symptoms"].append(s)

    if not e["chief_complaint"] and found:
        e["chief_complaint"] = found[0]

    # Severity scale extraction (e.g. "9/10", "8 out of 10")
    m = re.search(r"(\d+)\s*(?:/|out of)\s*10", t)
    if m:
        e["severity"] = min(10, max(1, int(m.group(1))))
    elif _has(t, ["severe", "unbearable", "very bad", "excruciating"]):
        e["severity"] = max(e["severity"] or 0, 8)
    elif "moderate" in t:
        e["severity"] = e["severity"] or 5
    elif "mild" in t:
        e["severity"] = e["severity"] or 3

    # Age extraction (years or months)
    m = re.search(r"(\d+)[- ]?(year|month)s?[- ]?old", t)
    if m:
        val = int(m.group(1))
        e["age"] = val / 12.0 if m.group(2) == "month" else float(val)
    elif re.search(r"\b(\d+)\s*(?:yo|y/o)\b", t):
        m2 = re.search(r"\b(\d+)\s*(?:yo|y/o)\b", t)
        e["age"] = float(m2.group(1))

    # Progression indicators
    for w in ("getting worse", "worsening", "rapidly", "suddenly", "improving"):
        if w in t:
            e["progression"] = w
            break

    # Onset time
    m = re.search(r"(\d+\s*(?:minute|min|hour|hr|day|week)s?\s*ago)", t) or re.search(
        r"(?:since|started)\s+(yesterday|this morning|last night|last week|today|\d+\s*(?:minute|min|hour|hr|day|week)s?(?:\s*ago)?)",
        t,
    )
    if m:
        e["onset_text"] = m.group(1)

    # Aggravating factors
    if _has(t, ["worse when", "on walking", "on exertion", "exertion"]):
        if "exertion" not in e["aggravating"]:
            e["aggravating"].append("exertion")

    return e


def parse_hours(text: str) -> float | None:
    t = text.lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week)s?", t)
    if m:
        units = {"minute": 1 / 60, "min": 1 / 60, "hour": 1, "hr": 1, "day": 24, "week": 168}
        return float(m.group(1)) * units[m.group(2)]
    presets = (
        ("last week", 168),
        ("yesterday", 24),
        ("last night", 12),
        ("this morning", 5),
        ("after lunch", 3),
        ("today", 3),
        ("just now", 0.1),
    )
    for k, h in presets:
        if k in t:
            return float(h)
    return None


def gaps(e: dict, full: str) -> list[dict]:
    t = full.lower()
    return [
        {"symptom": s, "missing": item, "question": q}
        for s in e.get("symptoms", [])
        for item, kws, q in PROTOCOL_GAPS.get(s, [])
        if not _has(t, kws)
    ]


def timeline(turns: list[str], now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    ev = []
    for i, t in enumerate(turns):
        h = parse_hours(t)
        if h is not None:
            ev.append({
                "at": (now - timedelta(hours=h)).isoformat(timespec="minutes"),
                "hours_ago": round(h, 2),
                "label": t[:90],
                "turn": i,
            })
    return sorted(ev, key=lambda x: x["at"])


def contradictions(turns: list[str]) -> list[dict]:
    cl = [
        (i, parse_hours(t), t)
        for i, t in enumerate(turns)
        if re.search(r"start|since|began|ago|had this", t.lower()) and parse_hours(t) is not None
    ]
    out = []
    for a in range(len(cl)):
        for b in range(a + 1, len(cl)):
            (i, h1, t1), (j, h2, t2) = cl[a], cl[b]
            ratio = max(h1, h2) / max(min(h1, h2), 0.05)
            if ratio >= 5 and abs(h1 - h2) >= 6:
                out.append({
                    "field": "onset",
                    "turn_a": i,
                    "turn_b": j,
                    "statement_a": t1,
                    "statement_b": t2,
                    "confidence": round(min(0.95, 0.5 + ratio / 40), 2),
                    "clarification": "Just to be sure, when did this problem first begin?",
                })
    return out


def red_flags(e: dict, text: str) -> list[str]:
    t = text.lower()
    s = set(e.get("symptoms", []))
    sev = e.get("severity") or 0
    f = []

    if "chest pain" in s and ({"sweating", "jaw pain", "arm pain", "shortness of breath", "dizziness"} & s):
        f.append("Acute chest pain with associated cardiac-type symptoms")
    if {"facial droop", "slurred speech"} & s or ("weakness" in s and _has(t, ["one side", "left side", "right side"])):
        f.append("Possible stroke signs (face/speech/one-sided weakness)")
    if "shortness of breath" in s and (_has(t, ["cannot speak", "can't speak", "blue lips", "gasping"]) or sev >= 8):
        f.append("Severe respiratory distress")
    if "bleeding" in s and _has(t, ["heavy", "a lot", "won't stop", "soaked", "severe", "profuse"]):
        f.append("Uncontrolled haemorrhage")
    if {"unconscious", "seizure"} & s or _has(t, ["confused", "not responding", "drowsy"]):
        f.append("Altered mental state / seizure")
    if "injury" in s and ("bleeding" in s or "unconscious" in s or sev >= 8):
        f.append("Severe trauma")
    if e.get("age") is not None and e["age"] < 3 and "fever" in s and _has(t, ["lethargic", "not feeding", "not drinking", "limp"]):
        f.append("Infant with fever and danger signs")
    
    # Paramedic Fast Codes and Critical Vitals (EMS Fast-Track)
    if _has(t, ["stemi", "code stemi", "acute coronary syndrome"]):
        f.append("Suspected STEMI / Acute Coronary Syndrome (EMS Code Red)")
    if _has(t, ["code stroke", "stroke protocol"]):
        f.append("Suspected Stroke (EMS Code Stroke Fast-Track)")
    if _has(t, ["major trauma", "code trauma"]):
        f.append("Major Trauma (EMS Priority Resuscitation)")
    if _has(t, ["resp_failure", "respiratory failure"]):
        f.append("Acute Respiratory Failure (EMS Code Resp)")
    
    spo2_match = re.search(r"spo2\s*[:=]?\s*(\d{1,3})", t)
    if spo2_match:
        try:
            val = int(spo2_match.group(1))
            if val < 90:
                f.append(f"Critical Hypoxia (SpO2 {val}%)")
        except ValueError:
            pass

    return f


def risk(e: dict, flags: list[str], source: str = "patient", asr_conf: float = 0.9) -> dict:
    score = 0
    why = []
    if flags:
        score += 100
        why += [f"Red flag: {x}" for x in flags]

    sev = e.get("severity") or 0
    if sev >= 8:
        score += 35
        why.append(f"Severity reported {sev}/10")
    elif sev >= 5:
        score += 20
        why.append(f"Moderate severity ({sev}/10)")

    if e.get("progression") in ("getting worse", "worsening", "rapidly", "suddenly"):
        score += 20
        why.append(f"Progression: {e['progression']}")

    h = parse_hours(e.get("onset_text") or "")
    if h is not None and h < 1:
        score += 15
        why.append("Rapid onset (<60 min)")

    if e.get("age") is not None and (e["age"] < 5 or e["age"] > 65):
        score += 10
        why.append("Age extreme (<5 or >65)")

    symptoms = e.get("symptoms", [])
    score += 8 * min(len(symptoms), 4)
    if symptoms:
        why.append("Symptoms: " + ", ".join(symptoms))

    tier = "critical" if score >= 100 else "urgent" if score >= 50 else "concerning" if score >= 25 else "stable"
    filled = sum(bool(e.get(k)) for k in ("chief_complaint", "severity", "onset_text", "progression"))
    src_weight = SOURCE_WEIGHT.get(source, 0.85)
    conf = round(min(0.97, (0.45 + 0.1 * filled) * (0.6 + 0.4 * asr_conf) * src_weight + (0.1 if flags else 0)), 2)

    return {
        "tier": tier,
        "score": min(score, 200),
        "is_emergency": bool(flags),
        "confidence": conf,
        "reasoning": (f"Assigned {tier.upper()}: " + "; ".join(why)) if why else "Insufficient information; Stable pending nurse review.",
        "disclaimer": "Triage intake aid only. Not a diagnosis. Final priority is set by clinical staff.",
    }


def readback_en(e: dict) -> str:
    p = [f"You told us about {e.get('chief_complaint') or 'a health problem'}"]
    symptoms = e.get("symptoms", [])
    if len(symptoms) > 1:
        p.append("along with " + ", ".join(symptoms[1:]))
    if e.get("onset_text"):
        p.append(f"starting {e['onset_text']}")
    if e.get("severity"):
        p.append(f"with severity {e['severity']} out of 10")
    return " ".join(p) + ". Is this correct?"


def check_emergency_guidance(red_flags_list: list[str], entities: dict) -> dict | None:
    """Checks for life-threatening warning signs (Feature 5 & 11) and advises calling 112."""
    symptoms = set(entities.get("symptoms", []))
    chief = (entities.get("chief_complaint") or "").lower()
    is_chest_pain = "chest pain" in symptoms or "chest pain" in chief

    if is_chest_pain or any("cardiac" in f.lower() or "stemi" in f.lower() for f in red_flags_list):
        return {
            "level": "CRITICAL_EMERGENCY",
            "alert": "POTENTIAL CARDIAC WARNING SIGN / CHEST PAIN DETECTED",
            "action": "Please contact emergency services immediately (Call 112 in India). Do not drive yourself. Lie down or rest in a comfortable position and avoid physical exertion.",
            "emergency_number": "112",
            "disclaimer": "Automated triage safety warning. Not a medical diagnosis.",
        }
    elif any("stroke" in f.lower() for f in red_flags_list):
        return {
            "level": "CRITICAL_EMERGENCY",
            "alert": "POTENTIAL STROKE WARNING SIGNS DETECTED",
            "action": "Immediate emergency evaluation is essential (Call 112 in India). Note onset time and proceed immediately to the nearest hospital with emergency stroke care.",
            "emergency_number": "112",
            "disclaimer": "Automated triage safety warning. Not a medical diagnosis.",
        }
    elif any("distress" in f.lower() or "hypoxia" in f.lower() or "unconscious" in f.lower() or "haemorrhage" in f.lower() for f in red_flags_list):
        return {
            "level": "EMERGENCY",
            "alert": "ACUTE CLINICAL EMERGENCY DETECTED",
            "action": "Immediate medical attention required. Call 112 in India or proceed to the nearest emergency department.",
            "emergency_number": "112",
            "disclaimer": "Automated triage safety warning. Not a medical diagnosis.",
        }
    return None


def generate_clinical_summary(sess: dict) -> dict:
    """Produces structured clinical intake summary compliant with SYNA requirements."""
    e = sess.get("entities") or {}
    transcripts = sess.get("transcripts") or []
    first_turn = transcripts[0] if transcripts else {}
    orig_statement = first_turn.get("native") or "Not provided"
    en_translation = first_turn.get("english") or "Not provided"

    symptoms = e.get("symptoms") or []
    chief = e.get("chief_complaint") or (symptoms[0] if symptoms else "Not provided")

    missing_items = [g.get("missing") for g in sess.get("gaps", [])]
    if not e.get("onset_text"):
        missing_items.append("Symptom onset time")
    if e.get("severity") is None:
        missing_items.append("Severity scale (0-10)")
    if not e.get("location"):
        missing_items.append("Anatomical location")

    # Evaluate structured questionnaire answers for explicit negatives & uncertainties
    questionnaire = sess.get("questionnaire") or []
    answers = sess.get("patient_answers") or {}
    eval_res = evaluate_questionnaire_answers(questionnaire, answers) if questionnaire else None

    explicit_negatives = eval_res["negative_findings"] if eval_res else []
    positive_findings = eval_res["positive_findings"] if eval_res else []
    uncertain_items = eval_res["uncertain_findings"] if eval_res else []
    unanswered_count = eval_res["unanswered_count"] if eval_res else 0

    return {
        "chief_complaint": chief,
        "original_language": sess.get("language", "en"),
        "original_patient_statement": orig_statement,
        "english_translation": en_translation,
        "symptom_onset": e.get("onset_text") or "Not provided",
        "duration": e.get("duration") or "Not yet assessed",
        "frequency": e.get("frequency") or ("Constant" if "constant" in str(transcripts).lower() else "Not provided"),
        "severity": f"{e['severity']}/10" if e.get("severity") is not None else "Not provided",
        "pain_location": e.get("location") or ("Chest / Retrosternal" if "chest pain" in symptoms else "Not provided"),
        "associated_symptoms": [s for s in symptoms if s != chief] if len(symptoms) > 1 else [],
        "relevant_medical_history": e.get("medical_history") or "Not provided",
        "missing_information": missing_items,
        "safety_flags": sess.get("red_flags") or [],
        "triage_priority": (sess.get("final_tier") or (sess.get("risk") or {}).get("tier") or "stable").upper(),
        "confidence_score": (sess.get("risk") or {}).get("confidence", 0.9),
        "intake_started": sess.get("started_at"),
        "intake_submitted": sess.get("submitted_at") or "In progress",
        "last_updated": sess.get("updated_at"),
        "nurse_reviewed_at": sess.get("reviewed_at") or "Awaiting nurse review",
        "nurse_notes": sess.get("nurse_notes") or "",
        "review_status": "Reviewed" if sess.get("status") == "verified" else "Awaiting nurse review",
        "questionnaire": questionnaire,
        "patient_answers": answers,
        "positive_findings": positive_findings,
        "explicit_negative_findings": explicit_negatives,
        "uncertain_findings": uncertain_items,
        "unanswered_questions_count": unanswered_count,
        "disclaimer": "Clinical intake aid only. Never diagnoses or prescribes. Final priority is set by clinical staff.",
    }


def process_turn(sess: dict, native: str, english: str, asr_conf: float = 0.9, now: datetime | None = None) -> dict:
    """One utterance through stages 2-9 + 11. Recalculates tier every turn."""
    now_dt = now or datetime.now(timezone.utc)
    asr_conf_val = float(asr_conf) if asr_conf is not None else 0.9
    sess.setdefault("transcripts", []).append({
        "native": native,
        "english": english,
        "asr_confidence": asr_conf_val,
        "timestamp": now_dt.isoformat(),
    })
    turns = [t["english"] for t in sess["transcripts"]]
    full = " ".join(turns)

    e = sess["entities"] = extract(english, sess.get("entities"))
    sess["gaps"] = gaps(e, full)
    
    # Semantic + Rule-based Contradiction Detection
    rule_contras = contradictions(turns)
    try:
        from backend.app.groq_client import detect_semantic_contradictions
        llm_contras = detect_semantic_contradictions(turns)
    except Exception:
        llm_contras = []
    sess["contradictions"] = rule_contras + [
        c for c in llm_contras
        if not any(rc.get("field") == c.get("field") and rc.get("turn_a") == c.get("turn_a") for rc in rule_contras)
    ]

    sess["timeline"] = timeline(turns, now_dt)
    
    # HARD SAFETY NET: Deterministic red flags cannot be overridden or downgraded by LLM
    sess["red_flags"] = red_flags(e, full)

    # 1. Generate 5-7 symptom questions batch immediately after initial statement if not already set
    curr_lang = (sess.get("language") or "en").split("-")[0].lower()
    cat = e.get("chief_complaint") or "general"
    if not sess.get("questionnaire"):
        sess["questionnaire"] = generate_symptom_questionnaire(
            chief_complaint=cat,
            entities=e,
            language=curr_lang,
        )
    else:
        # If questionnaire already exists, synchronize text_native with current session language
        template_qs = {q["id"]: q for q in generate_symptom_questionnaire(cat, e, curr_lang)}
        for q in sess["questionnaire"]:
            if q.get("id") in template_qs:
                q["text_native"] = template_qs[q["id"]]["text_native"]


    # 2. Evaluate questionnaire answers if present and merge any new red flags
    if sess.get("patient_answers"):
        eval_res = evaluate_questionnaire_answers(sess["questionnaire"], sess["patient_answers"])
        sess["questionnaire"] = eval_res["questions"]
        for rf in eval_res["red_flags"]:
            if rf not in sess["red_flags"]:
                sess["red_flags"].append(rf)

    min_asr = min((t.get("asr_confidence") or 0.9) for t in sess["transcripts"]) if sess["transcripts"] else 0.9
    sess["risk"] = risk(e, sess["red_flags"], sess.get("source", "patient"), min_asr)

    # Emergency Guidance Check (Feature 5 & 11)
    sess["emergency_guidance"] = check_emergency_guidance(sess["red_flags"], e)

    # Prioritize resolving contradictions, then context-aware LLM follow-up or protocol gap question
    if sess["contradictions"]:
        clarification = sess["contradictions"][0]["clarification"]
        sess["next_question"] = clarification
        sess["next_question_en"] = clarification
        sess["next_question_native"] = None
    elif sess["gaps"]:
        try:
            from backend.app.groq_client import generate_followup_question
            llm_res = generate_followup_question(english, e, sess["gaps"], sess.get("language", "en"), history=turns)
            if isinstance(llm_res, dict):
                q_en = llm_res.get("question_en")
                q_native = llm_res.get("question_native")
                if q_en and q_en != "INTAKE_COMPLETE":
                    sess["next_question"] = q_en
                    sess["next_question_en"] = q_en
                    sess["next_question_native"] = q_native
                else:
                    sess["next_question"] = None
                    sess["next_question_en"] = None
                    sess["next_question_native"] = None
            elif isinstance(llm_res, str) and llm_res != "INTAKE_COMPLETE":
                sess["next_question"] = llm_res
                sess["next_question_en"] = llm_res
                sess["next_question_native"] = None
            else:
                gap_q = sess["gaps"][0]["question"]
                sess["next_question"] = gap_q
                sess["next_question_en"] = gap_q
                sess["next_question_native"] = None
        except Exception:
            gap_q = sess["gaps"][0]["question"]
            sess["next_question"] = gap_q
            sess["next_question_en"] = gap_q
            sess["next_question_native"] = None
        if sess.get("next_question") == "INTAKE_COMPLETE":
            sess["next_question"] = None
            sess["next_question_en"] = None
            sess["next_question_native"] = None
    else:
        sess["next_question"] = None
        sess["next_question_en"] = None
        sess["next_question_native"] = None
    sess["readback_en"] = readback_en(e)

    sess["updated_at"] = now_dt.isoformat()
    sess["last_activity_at"] = now_dt.isoformat()
    sess["summary"] = generate_clinical_summary(sess)

    sess["handoff"] = {
        "demographics": {
            "age": e.get("age"),
            "source": sess.get("source"),
            "language": sess.get("language"),
        },
        "chief_complaint": e.get("chief_complaint"),
        "symptoms": e.get("symptoms", []),
        "severity": e.get("severity"),
        "timeline": sess["timeline"],
        "red_flags": sess["red_flags"],
        "triage_priority": sess["risk"]["tier"],
        "confidence": sess["risk"]["confidence"],
        "reasoning": sess["risk"]["reasoning"],
        "gaps": sess["gaps"],
        "contradictions": sess["contradictions"],
        "transcripts": sess["transcripts"],
        "summary": sess["summary"],
        "disclaimer": sess["risk"]["disclaimer"],
        "questionnaire": sess.get("questionnaire", []),
        "patient_answers": sess.get("patient_answers", {}),
    }
    return sess


def new_session(source: str = "patient", language: str = "en", channel: str = "kiosk") -> dict:
    """Creates a new session initialized with robust defaults so frontend reads never fail."""
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "source": source,
        "language": language,
        "channel": channel,
        "started_at": now_iso,
        "submitted_at": None,
        "reviewed_at": None,
        "updated_at": now_iso,
        "last_activity_at": now_iso,
        "confirmed_at": None,
        "escalation_status": "none",
        "patient_name": None,
        "nurse_notes": "",
        "transcripts": [],
        "messages": [],
        "questionnaire": [],
        "patient_answers": {},
        "entities": {
            "symptoms": [],
            "associated": [],
            "severity": None,
            "age": None,
            "progression": None,
            "onset_text": None,
            "chief_complaint": None,
            "aggravating": [],
            "relieving": [],
            "duration": None,
            "frequency": None,
            "location": None,
            "radiation": None,
            "medical_history": None,
        },
        "status": "pending_review",
        "gaps": [],
        "contradictions": [],
        "timeline": [],
        "red_flags": [],
        "risk": None,
        "emergency_guidance": None,
        "summary": None,
        "next_question": None,
        "next_question_en": None,
        "next_question_native": None,
        "readback_en": None,
        "handoff": None,
        "audit": [],
        "final_tier": None,
        "eta_minutes": None,
        "telemetry": None,
        "confirmed": False,
        "lifecycle_status": "active",
        "archived_at": None,
        "verified_at": None,
        "verified_by": None,
    }


def apply_override(sess: dict, nurse_id: str, action: str, new_tier: str | None, reason: str) -> dict:
    """Stage 12/13: nurse id + reason mandatory; verified state feeds physician queue."""
    if not nurse_id or not (nurse_id or "").strip():
        raise ValueError("nurse_id is required")
    if not reason or not (reason or "").strip():
        raise ValueError("reason is required for clinical audit log")

    if not sess.get("risk"):
        raise ValueError("Session has no risk assessment to review yet")

    old = sess["risk"]["tier"]
    i = TIERS.index(old) if old in TIERS else 0

    action = action.lower().strip()
    if action == "accept":
        new_tier = old
    elif action == "escalate":
        new_tier = new_tier.lower() if new_tier else TIERS[min(i + 1, len(TIERS) - 1)]
    elif action == "downgrade":
        new_tier = new_tier.lower() if new_tier else TIERS[max(i - 1, 0)]
    elif action == "override":
        if not new_tier or new_tier.lower() not in TIERS:
            raise ValueError(f"For override, new_tier must be one of: {', '.join(TIERS)}")
        new_tier = new_tier.lower()
    else:
        raise ValueError(f"Unknown review action: '{action}'. Expected accept, escalate, downgrade, or override.")

    if new_tier not in TIERS:
        raise ValueError(f"Invalid target tier '{new_tier}'. Allowed: {', '.join(TIERS)}")

    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sess.setdefault("audit", []).append({
        "nurse_id": nurse_id.strip(),
        "action": action,
        "old_tier": old,
        "new_tier": new_tier,
        "reason": reason.strip(),
        "at": now_iso,
    })
    sess["final_tier"] = new_tier
    sess["status"] = "verified"
    sess["lifecycle_status"] = "archived"
    sess["archived_at"] = sess.get("archived_at") or now_iso
    sess["verified_at"] = sess.get("verified_at") or now_iso
    sess["verified_by"] = nurse_id.strip()
    sess["reviewed_at"] = sess.get("reviewed_at") or now_iso
    return sess
