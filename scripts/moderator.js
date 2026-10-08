/**
 * Local self-contained content moderation engine.
 * The maintained word list lives in scripts/moderator-blocklist.json.
 */
const ContentModerator = (() => {
    const DEFAULT_BLOCKLIST = ["proxy", "vpn", "killing", "games"];

    const CHARACTER_MAP = {
        '4': 'a', '@': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e',
        '5': 's', '$': 's', '7': 't', 'x': 'x', '9': 'g', '8': 'b'
    };

    function normalizeText(rawInput) {
        if (typeof rawInput !== 'string') return '';
        let clean = rawInput.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let translated = '';
        for (let i = 0; i < clean.length; i++) {
            translated += CHARACTER_MAP[clean[i]] || clean[i];
        }
        return translated.replace(/[^a-z0-9]/g, '');
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function structuralSanitize(text, word) {
        if (word.length <= 2) return text;
        const midpoint = Math.floor(word.length / 2);
        const safeWord = word.substring(0, midpoint) + '-' + word.substring(midpoint + 1);
        const pattern = escapeRegExp(word).split('').join('[-_\\s]*');
        return text.replace(new RegExp(pattern, 'gi'), safeWord);
    }

    function clean(inputText) {
        const fallback = {isFlagged:false, output:inputText};
        if (typeof inputText !== 'string' || !inputText) return fallback;
        try {
            const normalizedTarget = normalizeText(inputText);
            let isFlagged = false;
            let output = inputText;
            for (const blockedWord of DEFAULT_BLOCKLIST) {
                if (typeof blockedWord !== 'string' || blockedWord.length < 3) continue;
                const normalizedWord = normalizeText(blockedWord);
                if (normalizedWord && normalizedTarget.includes(normalizedWord)) {
                    isFlagged = true;
                    output = structuralSanitize(output, blockedWord);
                }
            }
            return {isFlagged, output};
        } catch (_) {
            return fallback;
        }
    }

    return {clean};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ContentModerator;
