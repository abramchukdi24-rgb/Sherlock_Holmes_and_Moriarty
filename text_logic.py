import re
from collections import Counter

def calculate_frequency(ciphertext):
    """Считает частоту букв для гистограммы."""
    if not ciphertext:
        return {}
    text_clean = ciphertext.lower()
    letters = [char for char in text_clean if 'а' <= char <= 'я']
    total_letters = len(letters)
    if total_letters == 0:
        return {}
    counts = Counter(letters)
    frequency = {char: round((count / total_letters) * 100, 2) for char, count in counts.items()}
    return dict(sorted(frequency.items(), key=lambda item: item[1], reverse=True))


def apply_letter_replacements(ciphertext, replacements):
    """Применяет замены. Замененные буквы — ЗАГЛАВНЫЕ, незамененные — строчные."""
    if not ciphertext:
        return ""
    clean_replacements = {k.lower(): v.lower() for k, v in replacements.items() if v}
    result = []
    for char in ciphertext:
        char_lower = char.lower()
        if char_lower in clean_replacements:
            result.append(clean_replacements[char_lower].upper())
        else:
            if char_lower.isalpha():
                result.append(char_lower)
            else:
                result.append(char)
    return "".join(result)


def read_scytale_line(text, step=4, start_index=0):
    """Берет каждый step-ый символ (скитала)."""
    if not text:
        return ""
    return text[start_index::step]


def calculate_completion_percentage(ciphertext, replacements):
    """Считает процент разгаданных уникальных букв."""
    if not ciphertext:
        return 0.0
    unique_cipher_letters = set(char.lower() for char in ciphertext if 'а' <= char.lower() <= 'я')
    if not unique_cipher_letters:
        return 0.0
    solved_count = sum(1 for char in unique_cipher_letters if char in replacements and replacements[char])
    return round((solved_count / len(unique_cipher_letters)) * 100, 2)


def normalize_text(text):
    """Очищает текст для финального сравнения (только буквы а-я)."""
    if not text:
        return ""
    text_clean = text.lower().replace('ё', 'е')
    return re.sub(r'[^а-яa-z]', '', text_clean)