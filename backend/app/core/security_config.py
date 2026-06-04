from datetime import timedelta


SESSION_COOKIE_NAME = "educard_session"
CSRF_COOKIE_NAME = "educard_csrf"
SESSION_TTL = timedelta(minutes=30)
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
PASSWORD_MIN_LENGTH = 12
