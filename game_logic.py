import json
from flask import session, jsonify


# В game_logic.py обновляем функцию
def inject_dynamic_notification(scene_data, current_scene):
    # Вычисляем номер текущей задачи
    task_number = current_scene // 2 if current_scene % 2 == 0 else (current_scene // 2) + 1
    hints_used = session.get(f'task_{task_number}_hints_used', 0)

    # Массив уведомлений (можно расширять)
    notifications = {
        1: "[Системное уведомление: Вы нашли листок бумаги]",
        2: "[Системное уведомление: Похоже, вас ожидают]",
        3: "[Системное уведомление: Он оставил слишком много]"
    }
    notification_text = notifications.get(hints_used,"[Системное уведомление: Он оставил слишком много]" if hints_used >= 3 else None)

    scene_data["system_notification"] = notification_text
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

def get_scene_three_data():
    """Умная сборка Сцены №3 на основе прошлых выборов."""
    try:
        with open("data/scene_3.json", "r", encoding="utf-8") as f:
            full_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл scene_3.json не найден"}), 404

    task_1_solved = session.get('task_1_solved', False)
    time_left = session.get('time_left', 35)

    # Создаем итоговый плоский сценарий, который отдадим фронту
    final_scene = {
        "scene_id": 3,
        "background": full_data["background"],
        "intro_text_1": full_data["common_intro"]["text_1"],
        "intro_text_2": full_data["common_intro"]["text_2"],
        "interact": full_data["interact_action"],
        "outro_text": full_data["common_outro"]
    }

    # Склеиваем звонок Мориарти и ветку рапорта в зависимости от исхода
    if task_1_solved and time_left > 0:
        # ВЕТКА А (Успех)
        final_scene["moriarty_text"] = full_data["moriarty_speech"]["save_variant"]
        final_scene["report_text"] = full_data["branches"]["branch_a"]["text"]
        final_scene["system_notification"] = None
    else:
        # ВЕТКА Б (Провал)
        final_scene["moriarty_text"] = full_data["moriarty_speech"]["death_variant"]
        final_scene["report_text"] = full_data["branches"]["branch_b"]["text"]
        final_scene["system_notification"] = full_data["branches"]["branch_b"]["system_notification"]

        # Применяем штраф 10 минут за архив базы данных (один раз!)
        if not session.get('scene_3_penalty_applied', False):
            time_left = max(0, time_left - 10)
            session['time_left'] = time_left
            session['scene_3_penalty_applied'] = True

    # Записываем актуальное время
    final_scene["current_time_left"] = time_left

    return jsonify(final_scene)

def handle_scene_five_actions(action_id):
    """Логика для Сцены №5: Допрос курьера."""
    try:
        with open("data/scene_5.json", "r", encoding="utf-8") as f:
            scene_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл сцены 5 не найден"}), 404

    choices = scene_data.get("search_interact", {}).get("choices", [])
    selected_choice = next((c for c in choices if c["id"] == action_id), None)

    if not selected_choice:
        return jsonify({"error": "Действие не найдено"}), 400

    if action_id == 'interrogate':
        session['time_left'] = max(0, session.get('time_left', 40) - 10)
        return jsonify({
            "status": "continue",
            "text": selected_choice.get("result_text"),
            "time_left": session['time_left'],
            "system_notification": "[Системное уведомление: Вы потеряли 10 минут!]"
        })

    elif action_id == 'cipher':
        return jsonify({
            "status": "win",
            "text": selected_choice.get("result_text"),
            "time_left": session['time_left']
        })

def handle_scene_seven_actions(action_id):
    """Логика для Сцены №7: Финальный выбор."""
    if action_id == 'pass_by':
        session.clear()  # Игра окончена, очищаем сессию
        return jsonify({
            "status": "game_over_credits",
            "text": "Лестрейд прошел мимо... Игра окончена."
        })

    elif action_id == 'pick_card':
        return jsonify({
            "status": "easter_egg",
            "text": "Вы поднимаете карточку... На ней написано знакомым почерком..."
        })


