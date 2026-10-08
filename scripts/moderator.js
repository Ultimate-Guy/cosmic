/**
 * Local Self-Contained Content Moderation Engine
 * Managed automatically by GitHub Actions Automation.
 */
const ContentModerator = (() => {
    // The GitHub Action will automatically overwrite the array below.
    // DYNAMIC_ARRAY_PLACEHOLDER
    const DEFAULT_BLOCKLIST = ["proxy", "vpn", "killing", "games"]; 

    const CHARACTER_MAP = {
        '4': 'a', '@': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e', 
        '5': 's', '$': 's', '7': 't', 'x': 'x', '9': 'g', '8': 'b'
    };

    function normalizeText(rawInput) {
        if (typeof rawInput !== 'string') return '';
        let clean = rawInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        clean = clean.toLowerCase();
        let translated = "";
        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];
            translated += CHARACTER_MAP[char] || char;
        }
        return translated.replace(/[^a-z0-9]/g, '');
    }

    function structuralSanitize(text, word) {
        if (word.length <= 2) return text;
        const midpoint = Math.floor(word.length / 2);
        const structureSafeWord = word.substring(0, midpoint) + '-' + word.substring(midpoint + 1);
        const safeRegex = new RegExp(word.split('').join('[-_\\s]*'), 'gi');
        return text.replace(safeRegex, structureSafeWord);
    }

    return {
        clean: function(inputText) {
            const fallbackResponse = { isFlagged: false, output: inputText };
            if (!inputText || typeof inputText !== 'string') return fallbackResponse;

            try {
                const normalizedTarget = normalizeText(inputText);
                let isFlagged = false;
                let cleanOutput = inputText;

                for (const blockedWord of DEFAULT_BLOCKLIST) {
                    if (!blockedWord || blockedWord.length < 3) continue;
                    const normalizedWord = normalizeText(blockedWord);

                    if (normalizedTarget.includes(normalizedWord)) {
                        isFlagged = true;
                        cleanOutput = structuralSanitize(cleanOutput, blockedWord);
                    }
                }
                return { isFlagged: isFlagged, output: cleanOutput };
            } catch (error) {
                return fallbackResponse;
            }
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentModerator;
}
