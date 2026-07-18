# barberherman

Адаптивный одностраничный сайт [barberherman.ru](https://barberherman.ru/) на чистых HTML, CSS и JavaScript. В основе — содержание и композиция исходного проекта Readymag, собранные заново в естественном адаптивном потоке.

## Локальный запуск

Сайт статический и не требует сборки:

```bash
python3 -m http.server 8080
```

Откройте `http://localhost:8080`.

## Публикация

Проект подготовлен для GitHub Pages. Канонический адрес сайта — `https://barberherman.ru/`; привязка домена и HTTPS управляются в настройках GitHub Pages.

Шрифты Bebas Neue и Golos Text Variable хранятся локально на условиях SIL Open Font License 1.1; тексты лицензий находятся рядом с файлами шрифтов.

## Живой статус

Погода Москвы загружается напрямую из Open-Meteo и кратковременно кешируется в браузере. Без подтверждённого realtime-источника ячейка посетителей скрыта, а погода занимает всю ширину финального этажа.

### Realtime-посетители

Счётчик работает через Firebase Anonymous Authentication и Realtime Database REST API. Одной активной сессией считается одна вкладка браузера, подтверждающая присутствие каждые 25 секунд. Запись считается активной 75 секунд; протухшие записи безопасно удаляются после трёх минут. Личные данные и cookies для этого не собираются; короткоживущая анонимная авторизация хранится только в `sessionStorage`.

Для включения:

1. Создать Firebase-проект, включить провайдер Anonymous в Authentication, добавить `barberherman.ru` в Authorized domains и создать Realtime Database в locked mode.
2. Связать локальный каталог с проектом через Firebase CLI и опубликовать `firebase.database.rules.json` командой `firebase deploy --only database`.
3. Добавить к корневому `<html>` в `index.html` атрибуты `data-presence-endpoint="https://PROJECT-default-rtdb.REGION.firebasedatabase.app/presence"` и `data-presence-api-key="WEB_API_KEY"`.

Web API key Firebase публичен по дизайну; доступ ограничивают Anonymous Authentication и правила базы. Интерфейс показывает счётчик только после первого успешного запроса и не подставляет число при ошибке.
