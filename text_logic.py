from collections import Counter


def calculate_frequency(ciphertext):
    """
    Принимает строку. Возвращает словарь, отсортированный по убыванию частоты: {'о': 11.2, 'а': 8.5...}.
    """
    if not ciphertext:
        return {}

    text_clean = ciphertext.lower()
    letters = [char for char in text_clean if 'а' <= char <= 'я']
    total_letters = len(letters)
    if total_letters == 0:
        return {}

    counts = Counter(letters)
    frequency = {char: round((count / total_letters) * 100, 2) for char, count in counts.items()}
    sorted_frequency = dict(sorted(frequency.items(), key=lambda item: item[1], reverse=True))

    return sorted_frequency


def apply_letter_replacements(ciphertext, replacements):
    """
    Принимает исходный шифртекст и словарь замен вида {'а': 'О', 'б': 'Н'}.
    Возвращает текст, где замененные буквы заглавные, а остальные — строчные.
    """
    if not ciphertext:
        return ""

    result = []
    for char in ciphertext:
        # Приводим к нижнему регистру для поиска в словаре замен
        char_lower = char.lower()

        if char_lower in replacements:
            # Берем замену. Если оригинальная буква была заглавной,
            # сохраняем заглавную, иначе делаем строчной (или оставляем как прислал фронт)
            replacement_char = replacements[char_lower]
            if char.isupper():
                result.append(replacement_char.upper())
            else:
                result.append(replacement_char.lower())
        else:
            # Если замены нет, оставляем оригинальный символ
            result.append(char)

    return "".join(result)


def read_scytale_line(text, step, start_index=0):
    if not text:
        return ""
    return text[start_index::step]