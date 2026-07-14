from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from game_logic import inject_dynamic_notification, handle_scene_one_actions, get_scene_three_data, handle_scene_five_actions, handle_scene_seven_actions
from text_logic import apply_letter_replacements, read_scytale_line, normalize_text, calculate_completion_percentage, calculate_frequency
import os
import json

app = Flask(__name__)
# ключ для шифрования данных сессии
app.secret_key = os.urandom(24)


# ==========================================
# НАСТРОЙКИ (ПРИМЕР)
# ==========================================
@app.route('/settings/toggle_sound', methods=['POST'])
def toggle_sound():
    # Меняем состояние звука в сессии
    current_sound = session.get('sound', True)
    session['sound'] = not current_sound

    return jsonify({"sound": session['sound']})


# ==========================================
# 1 ГЛАВНОЕ МЕНЮ И СТАРТ/ПРОДОЛЖЕНИЕ ИГРЫ
# ==========================================
@app.route('/')
def menu():
    game_started = session.get('game_started', False)
    action_button_text = "Продолжить дело" if game_started else "Открыть дело"
    action_url = url_for('continue_game') if game_started else url_for('start_game')

    return f"""
        <h1>🕵 Главное меню: Дело Мориарти</h1>
        <p>Настройки: Звук [{'ВКЛ' if session.get('sound', True) else 'ВЫКЛ'}]</p>
        <hr>
        <a href="{action_url}"><button>{action_button_text}</button></a><br><br>
        <a href="/exit_game"><button>Выход</button></a>
    """


@app.route('/start')
def start_game():
    """Инициализация новой игры. Всегда с 1-й сцены."""
    session['game_started'] = True
    session['current_scene'] = 1
    session['time_left'] = 40
    session['task_1_solved'] = False
    return redirect(url_for('get_scene_data'))


@app.route('/continue')
def continue_game():
    """Продолжение игры с сохраненного места (начала текущей сцены)."""
    return redirect(url_for('get_scene_data'))


@app.route('/exit_game')
def exit_game():
    session.clear()
    return "<h1>Игра закрыта. Сессия очищена.</h1><a href='/'>Вернуться в меню</a>"


# ==========================================
# 2 ЕДИНЫЙ РОУТ ДЛЯ ВЫДАЧИ СЦЕН
# ==========================================
@app.route('/api/scene', methods=['GET'])
def get_scene_data():
    current_scene = session.get('current_scene', 1)

    if current_scene == 3:
        return get_scene_three_data()

    file_name = None

    if current_scene % 2 == 0:
        task_number = current_scene // 2
        task_solved = session.get(f'task_{task_number}_solved', False)
        time_left = session.get('time_left', 0)

        if task_solved and time_left > 0:
            file_name = f"scene_{current_scene}_save.json"
        else:
            file_name = f"scene_{current_scene}_death.json"

    # Сцена 7
    elif current_scene == 7:
        solved_count = sum([1 for i in range(1, 4) if session.get(f'task_{i}_solved', False)])
        if solved_count == 3:
            file_name = "scene_7_win.json"
        elif solved_count == 2:
            file_name = "scene_7_equal.json"
        else:
            file_name = "scene_7_loose.json"
    else:
        file_name = f"scene_{current_scene}.json"

    file_path = f"data/{file_name}"

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            scene_data = json.load(f)

        # 1. запомнить время в сессии
        if 'time_left' not in session or session.get('last_tracked_scene') != current_scene:
            # Берём лимит из JSON файла сцены
            session['time_left'] = scene_data.get("initial_time_limit", 40)
            # Запоминаем, для какой сцены мы только что инициализировали этот таймер
            session['last_tracked_scene'] = current_scene

            # 2. добавляем динамическое время из сессии в JSON
        scene_data["current_time_left"] = session['time_left']

        # 3. Добавляем системные уведомления
        scene_data = inject_dynamic_notification(scene_data, current_scene)

        return jsonify(scene_data)
    except FileNotFoundError:
        return jsonify({"error": f"Файл сценария {file_path} не найден."}), 404

@app.route('/api/game/action', methods=['POST'])
def game_action():
    data = request.json or {}
    action_id = data.get('action_id')
    current_scene = session.get('current_scene', 1)

    # Диспетчер просто вызывает функции из внешнего файла game_logic.py
    if current_scene == 1:
        return handle_scene_one_actions(action_id)
    elif current_scene == 5:
        return handle_scene_five_actions(action_id)
    elif current_scene == 7:
        return handle_scene_seven_actions(action_id)

    return jsonify({"error": "В сцене нет доступных действий"}), 400

# ==========================================
# 4 ЗАДАЧИ
# ==========================================
@app.route('/tasks')
def main_tasks():
    """
    Основная страница с задачами
    """
    # Проверяем, начата ли вообще игра
    if not session.get('game_started'):
        return redirect(url_for('menu'))

    # Рендерим шаблон tasks.html
    return render_template('tasks.html')

def load_task_data(task_id):
    """Вспомогательная функция для загрузки статического JSON задачи."""
    try:
        with open(f"data/task_{task_id}.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

@app.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    """
    Отдает фронту данные задачи: статику из JSON + динамику из сессии.
    """
    task_data = load_task_data(task_id)
    if not task_data:
        return jsonify({"error": f"Задача {task_id} не найдена"}), 404

    # Вытаскиваем динамические данные из сессии
    replacements_key = f"task_{task_id}_replacements"
    if replacements_key not in session:
        session[replacements_key] = {}

    current_replacements = session[replacements_key]
    time_left = session.get('time_left')

    # Применяем замены к шифртексту + частотный анализ
    ciphertext = task_data["ciphertext"]
    decoded_text = apply_letter_replacements(ciphertext, current_replacements)
    freq = calculate_frequency(ciphertext)

    # Считаем процент выполнения
    completion = calculate_completion_percentage(ciphertext, current_replacements)

    # Собираем ответ для фронтенда
    response_data = {
        "task_id": task_data["task_id"],
        "intro_slides": task_data.get("intro_slides", []),
        "use_scytale": task_data.get("use_scytale", False),
        "ciphertext": ciphertext,
        "decoded_text": decoded_text,
        "frequencies": freq,
        "current_replacements": current_replacements,
        "current_time_left": time_left,
        "completion_percentage": completion
    }
    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True)