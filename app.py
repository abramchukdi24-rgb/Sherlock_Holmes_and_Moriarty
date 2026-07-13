from flask import Flask, render_template, request, session, redirect, url_for
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
    session['sound'] = not session.get('sound', True)
    return redirect(request.referrer or url_for('menu'))


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
    branching_scenes = [2, 4, 6]

    # 1. Автоматически определяем имя файла сценария
    if current_scene in branching_scenes:
        # Сцены-развилки зависят от флага решения задач
        task_number = current_scene // 2
        task_solved = session.get(f'task_{task_number}_solved', False)

        # Проверяем, осталось ли время на момент фиксации задачи
        time_left = session.get('time_left', 0)

        if task_solved and time_left > 0:
            file_name = f"scene_{current_scene}_save.json"
        else:
            file_name = f"scene_{current_scene}_death.json"

    elif current_scene == 7:
        solved_count = sum([1 for i in range(1, 4) if session.get(f'task_{i}_solved', False)])
        if solved_count == 3:
            file_name = "scene_7_win.json"
        elif solved_count == 2:
            file_name = "scene_7_equal.json"
        else:
            file_name = "scene_7_loose.json"
    else:
        # Обычные сюжетные сцены (1, 3, 5)
        file_name = f"scene_{current_scene}.json"

    file_path = f"data/{file_name}"

    # 2. Читаем файл сценария
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            scene_data = json.load(f)

        # 3. ПОДСТРАХОВКА ВРЕМЕНИ (Динамический патч)
        # Мы НЕ пишем сюда дефолтные 40. Мы смотрим: если в сессии ПРЯМО СЕЙЧАС
        # идет игра и тикает время, мы отдаем фронту актуальное значение.
        if 'time_left' in session:
            scene_data["current_time_left"] = session['time_left']
        else:
            # Если таймер еще не запущен в сессии, фронт возьмет
            # статичное изначальное время прямо из тела самого json (например, scene_data["task_time_limit"])
            scene_data["current_time_left"] = scene_data.get("task_time_limit", None)

        if current_scene in branching_scenes:
            # Берем из сессии количество подсказок, которые юзер потратил на этой задаче
            hints_used = session.get(f'task_{current_scene // 2}_hints_used', 0)

            # Определяем текст системного уведомления на основе счетчика подсказок
            if hints_used == 1:
                system_notification = "[Системное уведомление: Вы нашли листок бумаги]"
            elif hints_used == 2:
                system_notification = "[Системное уведомление: Похоже, вас ожидают]"
            elif hints_used >= 3:
                system_notification = "[Системное уведомление: Он оставил слишком много]"
            else:
                system_notification = None  # Если 0 подсказок — уведомления нет

            # Добавляем уведомление в JSON, чтобы фронт его поймал и отрендерил отдельной плашкой
            scene_data["system_notification"] = system_notification

        return scene_data

    except FileNotFoundError:
        return {"error": f"Файл сценария {file_path} не найден."}, 404


@app.route('/api/game/action', methods=['POST'])
def game_action():
    data = request.json or {}
    action_id = data.get('action_id')
    current_scene = session.get('current_scene', 1)

    # Диспетчер просто распределяет работу по сценам
    if current_scene == 1:
        return handle_scene_one_actions(action_id)
    elif current_scene == 3:
        return handle_scene_three_actions(action_id)
    # И так далее для каждой интерактивной сцены...

    return {"error": "В этой сцене нет доступных интерактивных действий"}, 400


# ==========================================
# функции обработки интерактивов сюжетных
# ==========================================

def handle_scene_one_actions(action_id):
    """Логика интерактивов для Сцены №1 (Кабинет)."""
    if action_id == 'table':
        session['time_left'] = max(0, session.get('time_left', 40) - 5)
        return {
            "status": "continue",
            "text": "Ящики заперты! (-5 минут)",
            "time_left": session['time_left']
        }
    elif action_id == 'door':
        return {
            "status": "win",
            "text": "Отлично! В кармане лежит конверт!",
            "redirect_url": "/tasks"
        }
    return {"error": "Неизвестное действие для сцены 1"}, 400


def handle_scene_three_actions(action_id):
    """ПРИМЕР ТУПАЯ ЗАГЛУШКА"""
    if action_id == 'check_glovebox':
        return {"status": "continue", "text": "Бардачок пуст, только старые штрафы."}
    elif action_id == 'check_seat':
        return {"status": "win", "text": "Под сиденьем вы нашли скрытый диктофон!"}
    return {"error": "Неизвестное действие для сцены 3"}, 400


# ==========================================
# 4 ЗАДАЧИ И ПАСХАЛКИ
# ==========================================
@app.route('/tasks')
def main_tasks():
    # Быстрый чит-код для проверки Сцены 2: /tasks?solve=true
    if request.args.get('solve') == 'true':
        session['task_1_solved'] = True
        session['current_scene'] = 2  # Переключаем сессию на вторую сцену
        return "<h3>Успех! Задача решена, сессия переключена на Сцену 2. <a href='/api/scene'>Перейти к результату</a></h3>"

    # Чит-код для провала: /tasks?solve=false
    if request.args.get('solve') == 'false':
        session['task_1_solved'] = False
        session['current_scene'] = 2
        return "<h3>Время вышло! Задача провалена, сессия переключена на Сцену 2. <a href='/api/scene'>Перейти к результату</a></h3>"

    return f"""
        <h2>🧩 Экран главных задач</h2>
        <p>Оставшееся время: {session.get('time_left', 40)} мин.</p>
        <a href="/tasks?solve=true"><button>Имитировать УСПЕХ (Спасение)</button></a> | 
        <a href="/tasks?solve=false"><button>Имитировать ПРОВАЛ (Смерть)</button></a> <br><br>
        <a href="/easter_egg"><button>Пойти искать пасхалку</button></a> | 
        <a href="/"><button>В меню</button></a>
    """


@app.route('/easter_egg')
def easter_egg():
    """ЭТО ОКНО ЗАДАЧИ ДЛЯ ПАСХАЛКИ, ЗАГЛУШКА СЕЙЧАС"""
    return """
        <h2>🥚 Экран пасхалки</h2>
        <p>Вы нашли секретное досье Мориарти!</p>
        <a href="/tasks"><button>Назад к задачам</button></a>
    """


if __name__ == '__main__':
    app.run(debug=True)