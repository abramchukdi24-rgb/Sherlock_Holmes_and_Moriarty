import json
from flask import session, jsonify


# В game_logic.py обновляем функцию
def inject_dynamic_notification(scene_data, current_scene):
    t1 = session.get('task_1_solved', False)
    t2 = session.get('task_2_solved', False)
    t3 = session.get('task_3_solved', False)
    solved_count = sum([t1, t2, t3])
    
    notification = None

    # Сцена 4 (Результат 2 задания)
    if current_scene == 4 and t2:
        if t1 and t2: notification = "ПОХОЖЕ, ВАС ОЖИДАЮТ"
        else: notification = "ВЫ НАШЛИ ЛИСТОК БУМАГИ"

    # Сцена 6 (Результат 3 задания)
    elif current_scene == 6 and t3:
        if solved_count == 3: notification = "ОН ОСТАВИЛ СЛИШКОМ МНОГО"
        elif solved_count == 2: notification = "ПОХОЖЕ, ВАС ОЖИДАЮТ"
        else: notification = "ВЫ НАШЛИ ЛИСТОК БУМАГИ"

    scene_data["system_notification"] = notification
    return scene_data

def apply_penalty(penalty_minutes, current_scene_id, action_id=None):
    """
    Вычитает штраф из времени сессии первый раз взаимодействия.
    Возвращает кортеж: (new_time, is_game_over)
    """
    # Достаем список уже примененных штрафов
    applied_penalties = session.get('applied_penalties', [])

    # Создаем уникальный ключ текущего действия + берем время
    penalty_key = f"scene_{current_scene_id}_{action_id}" if action_id else f"scene_{current_scene_id}"
    current_time = session.get('time_left', 40)

    # игнорир
    if penalty_key in applied_penalties:
        return current_time, current_time <= 0

    # штраф новый
    if penalty_minutes > 0:
        current_time = max(0, current_time - penalty_minutes)
        session['time_left'] = current_time

        # Запоминаем, что этот штраф мы списали
        applied_penalties.append(penalty_key)
        session['applied_penalties'] = applied_penalties
        session.modified = True
    return current_time

def handle_scene_one_actions(action_id):
    """Логика для Сцены №1: Кабинет. Чистый поиск в JSON."""
    try:
        with open("data/scene_1.json", "r", encoding="utf-8") as f:
            scene_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл сцены 1 не найден"}), 404

    choices = scene_data.get("search_interact", {}).get("choices", [])
    selected_choice = next((c for c in choices if c["id"] == action_id), None)

    penalty = selected_choice.get("penalty_minutes", 0)
    time_left = apply_penalty(penalty, current_scene_id=1, action_id=action_id)

    return jsonify({
        "status": "win" if selected_choice.get("is_win") else "continue",
        "text": selected_choice.get("result_text"),
        "time_left": time_left
    })

def get_scene_three_data():
    try:
        with open("data/scene_3.json", "r", encoding="utf-8") as f:
            full_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл scene_3.json не найден"}), 404

    task_1_solved = session.get('task_1_solved', False)
    time_left = session.get('time_left', 35)

    # 1. Выбираем, какой текст показать (спасение или смерть)
    moriarty_var = full_data["moriarty_variations"]["save"] if task_1_solved else full_data["moriarty_variations"]["death"]
    report_branch = full_data["branches"]["branch_a"] if task_1_solved else full_data["branches"]["branch_b"]

    # 2. СКЛЕИВАЕМ ВСЁ В ОДИН МАССИВ (чтобы JS просто листал текст)
    # Интро + Реплика Мориарти + Прощание Мориарти + Рапорт + Финал
    all_steps = full_data["intro_steps"] + [moriarty_var] + full_data["moriarty_outro"] + report_branch + full_data["final_steps"]

    # 3. Прикрепляем уведомление к последнему шагу рапорта, если был провал
    if not task_1_solved:
        # Ищем шаг про базу данных
        for step in all_steps:
            if "Поиск по свежим записям" in step["text"]:
                step["system_notification"] = "ВЫ ПОТЕРЯЛИ 10 МИНУТ ПРИ РАБОТЕ С БАЗОЙ ДАННЫХ"
        
        # Списываем время
        if not session.get('scene_3_penalty_applied', False):
            time_left = max(0, time_left - 10)
            session['time_left'] = time_left
            session['scene_3_penalty_applied'] = True

    final_scene = {
        "scene_id": 3,
        "background": full_data["background"],
        "intro_steps": all_steps, # JS увидит это и просто всё пролистает
        "current_time_left": time_left
    }
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

    penalty = selected_choice.get("penalty_minutes", 0)

    if 'time_left' not in session:
        session['time_left'] = 30

    time_left = apply_penalty(penalty, current_scene_id=5, action_id=action_id)

    return jsonify({
        "status": "win" if selected_choice.get("is_win") else "continue",
        "dialogue_steps": selected_choice.get("dialogue_steps", []),
        "time_left": time_left,
        "system_notification": selected_choice.get("system_notification")
    })


def handle_scene_seven_actions(action_id):
    """Логика для Сцены №7: Финальный выбор (Динамическое чтение из JSON)."""

    solved_count = sum([1 for i in range(1, 4) if session.get(f'task_{i}_solved', False)])
    if solved_count == 3:
        file_name = "scene_7_win.json"
    elif solved_count == 2:
        file_name = "scene_7_equal.json"
    else:
        file_name = "scene_7_loose.json"

    try:
        with open(f"data/{file_name}", "r", encoding="utf-8") as f:
            scene_data = json.load(f)
    except FileNotFoundError:
        return jsonify({"error": "Файл концовки не найден"}), 404

    # 3. Ищем, на какую кнопку нажал игрок
    choices = scene_data.get("final_choice_interact", {}).get("choices", [])
    selected_choice = next((c for c in choices if c["id"] == action_id), None)

    if not selected_choice:
        return jsonify({"error": "Действие не найдено"}), 400

    dialogue_step = selected_choice.get("dialogue_step")
    easter_egg_puzzle = selected_choice.get("easter_egg_puzzle")

    if action_id == 'go_away':
        session.clear()
        return jsonify({
            "status": "game_over_credits",
            "dialogue_step": dialogue_step
        })

    elif action_id == 'pick_card':
        # Игрок поднимает карточку — запускаем финальное микро-испытание
        return jsonify({
            "status": "start_final_puzzle",
            "dialogue_step": dialogue_step,
            "puzzle_config": {
                "timer_limit_seconds": easter_egg_puzzle.get("timer_limit_seconds"),
                "correct_word": easter_egg_puzzle.get("correct_word"),
                "win_branch": easter_egg_puzzle.get("win_branch"),
                "lose_branch": easter_egg_puzzle.get("lose_branch")
            }
        })


