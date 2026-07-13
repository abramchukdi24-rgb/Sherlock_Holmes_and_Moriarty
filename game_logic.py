import json
from flask import session, jsonify

def inject_dynamic_notification(scene_data, task_number, step_index):

    # Получаем счетчик подсказок именно для этой задачи (например, task_1_hints_used)
    hints_used = session.get(f'task_{task_number}_hints_used', 0)

    if hints_used == 1:
        notification = "[Системное уведомление: Вы нашли листок бумаги]"
    elif hints_used == 2:
        notification = "[Системное уведомление: Похоже, вас ожидают]"
    elif hints_used >= 3:
        notification = "[Системное уведомление: Он оставил слишком много]"
    else:
        notification = None

    # Если уведомление есть и шаг существует, вшиваем его
    if notification and len(scene_data.get("dialogue_steps", [])) > step_index:
        scene_data["dialogue_steps"][step_index]["system_notification"] = notification

    return scene_data


import json
from flask import session, jsonify


def handle_scene_one_actions(action_id):
    """Логика для Сцены №1: Кабинет. Чистый поиск в JSON."""
    try:
        with open("data/scene_1.json", "r", encoding="utf-8") as f:
            scene_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл сцены 1 не найден"}), 404

    choices = scene_data.get("search_interact", {}).get("choices", [])
    selected_choice = next((c for c in choices if c["id"] == action_id), None)

    if not selected_choice:
        return jsonify({"error": "Действие не найдено"}), 400

    # Списываем штраф, который указан в самом JSON
    penalty = selected_choice.get("penalty_minutes", 0)
    if penalty > 0:
        session['time_left'] = max(0, session.get('time_left', 40) - penalty)

    return jsonify({
        "status": "win" if selected_choice.get("is_win") else "continue",
        "text": selected_choice.get("result_text"),
        "time_left": session['time_left']
    })


