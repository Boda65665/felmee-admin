# Развёртывание админки

Адрес: **https://64.188.118.144:8443**. На портах 80/443 уже работает LimiLink,
поэтому админка использует отдельный HTTPS-порт. Backend — **https://felmee.com**.

Админка — статическая сборка Vite. Node.js, PostgreSQL и Redis для её обслуживания
на этом сервере не нужны. nginx раздаёт `dist/`, проксирует `/api/` и `/ws` на
backend с проверкой его TLS-сертификата. Авторизация остаётся на backend.

## Файлы на сервере

- `/srv/felmee-admin/releases/20261116-170535/` — активная сборка от 16 ноября 2026 года (включает текущие локальные изменения).
- `/srv/felmee-admin/releases/0c38ae2-20261113/` — предыдущая сборка для отката.
- `/srv/felmee-admin/current` — ссылка на активную сборку.
- `/etc/nginx/sites-available/felmee-admin` — конфигурация из `deploy/nginx.conf`.
- `/etc/nginx/sites-enabled/felmee-admin` — включённый сайт nginx.
- `/var/log/nginx/felmee-admin.access.log` и `felmee-admin.error.log` — журналы.

При сборке `VITE_API_BASE_URL` должен быть пустым. Браузер отправляет запросы на
тот же адрес, где открыта админка; nginx перенаправляет их на `felmee.com`.
WebSocket проксируется с Origin `https://felmee.com`, который разрешён backend.
JWT по-прежнему проверяется в STOMP CONNECT.

## HTTPS и автоматическое продление

Используется уже выпущенный сертификат Let's Encrypt для IP `64.188.118.144`:

```text
/srv/limilink/tls/live/64.188.118.144/fullchain.pem
/srv/limilink/tls/live/64.188.118.144/privkey.pem
```

Имена и пути существующей инфраструктуры сохранены. Сертификат общий для портов
443 и 8443. `limilink-cert-renew.timer` проверяет необходимость продления каждые
шесть часов с задержкой до 30 минут. Скрипт `/srv/limilink/renew-certificate.sh`
использует Certbot 5.9.0 в Docker и после продления проверяет и перезагружает
конфигурацию nginx. Тестовое продление `certbot renew --dry-run` прошло успешно.

Для продления должны оставаться доступными порт 80, ACME webroot
`/srv/limilink/acme`, каталог сертификатов и Docker. При удалении LimiLink эту
инфраструктуру нужно сохранить или перенести вместе с путями nginx.

```bash
systemctl status limilink-cert-renew.timer
journalctl -u limilink-cert-renew.service -n 30 --no-pager
openssl x509 -in /srv/limilink/tls/live/64.188.118.144/fullchain.pem -noout -dates
```

## Обновление сборки

Собрать проект с пустым `VITE_API_BASE_URL` и загрузить **только содержимое
`dist/`** в новый каталог `/srv/felmee-admin/releases/<версия>/`. Не загружать
`.env`, ключи, `node_modules` и временные файлы разработки.

После проверки файлов переключить ссылку на сервере:

```bash
ln -s /srv/felmee-admin/releases/<версия> /srv/felmee-admin/current.next
mv -Tf /srv/felmee-admin/current.next /srv/felmee-admin/current
nginx -t && systemctl reload nginx
curl --fail --retry 5 --retry-connrefused --retry-delay 1 https://64.188.118.144:8443/
```

Предыдущую сборку сохранять до проверки новой. Для отката переключить `current`
на предыдущий каталог теми же командами. Перезапуск backend и сервера не нужен.

Проверка после обновления: открыть `/login` и `/documents`, проверить загрузку
JS/CSS и ответы API. Без авторизации защищённый API должен отвечать `401`.
Работу под учётной записью администратора проверять обычным входом; банковские
операции не запускать в рамках проверки развёртывания.
