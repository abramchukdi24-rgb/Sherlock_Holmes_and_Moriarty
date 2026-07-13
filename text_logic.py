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



