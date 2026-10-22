import secrets
import warnings
from typing import Annotated, Any, Literal

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL
from typing_extensions import Self


def parse_cors(v: Any) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",") if i.strip()]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Use top level .env file (one level above ./backend/)
        env_file=("../.env", "../.env.local"),
        env_ignore_empty=True,
        extra="ignore",
    )
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[
        list[AnyUrl] | str, BeforeValidator(parse_cors)
    ] = []

    @computed_field  # type: ignore[prop-decorator]
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str
    SENTRY_DSN: HttpUrl | None = None
    DB_CONNECTION: Literal["sqlsrv"] = "sqlsrv"
    DB_HOST: str
    DB_PORT: int | None = None
    DB_DATABASE: str
    DB_USERNAME: str
    DB_PASSWORD: str
    DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_ENCRYPT: bool = True
    DB_TRUST_SERVER_CERTIFICATE: bool = True
    DB_QUERY_TIMEOUT: int = 15

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> URL:
        return URL.create(
            "mssql+pyodbc",
            username=self.DB_USERNAME,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_DATABASE,
            query={
                "driver": self.DB_DRIVER,
                "Encrypt": "yes" if self.DB_ENCRYPT else "no",
                "TrustServerCertificate": (
                    "yes" if self.DB_TRUST_SERVER_CERTIFICATE else "no"
                ),
            },
        )

    # MES 正式區（唯讀報表用），設定放 .env.local；未設定時 MES 報表回 503
    MES_PROD_DB_HOST: str | None = None
    MES_PROD_DB_PORT: int | None = None
    MES_PROD_DB_DATABASE: str = "MWF_GTIMES5"
    MES_PROD_DB_USERNAME: str | None = None
    MES_PROD_DB_PASSWORD: str | None = None
    MES_PROD_DB_ENCRYPT: bool = True
    MES_PROD_DB_TRUST_SERVER_CERTIFICATE: bool = True

    @computed_field  # type: ignore[prop-decorator]
    @property
    def MES_SQLALCHEMY_DATABASE_URI(self) -> URL | None:
        if not self.MES_PROD_DB_HOST:
            return None
        return URL.create(
            "mssql+pyodbc",
            username=self.MES_PROD_DB_USERNAME,
            password=self.MES_PROD_DB_PASSWORD,
            host=self.MES_PROD_DB_HOST,
            port=self.MES_PROD_DB_PORT,
            database=self.MES_PROD_DB_DATABASE,
            query={
                "driver": self.DB_DRIVER,
                "Encrypt": "yes" if self.MES_PROD_DB_ENCRYPT else "no",
                "TrustServerCertificate": (
                    "yes" if self.MES_PROD_DB_TRUST_SERVER_CERTIFICATE else "no"
                ),
            },
        )

    # MES 測試區（唯讀；僅用來經 linked server TOPPROD 查 TIPTOP Oracle），設定放 .env.local
    MES_TEST_DB_HOST: str | None = None
    MES_TEST_DB_PORT: int | None = None
    MES_TEST_DB_DATABASE: str = "MWF_GTIMES5"
    MES_TEST_DB_USERNAME: str | None = None
    MES_TEST_DB_PASSWORD: str | None = None
    MES_TEST_DB_ENCRYPT: bool = True
    MES_TEST_DB_TRUST_SERVER_CERTIFICATE: bool = True
    MES_TEST_DB_QUERY_TIMEOUT: int = 15

    @computed_field  # type: ignore[prop-decorator]
    @property
    def MES_TEST_SQLALCHEMY_DATABASE_URI(self) -> URL | None:
        if not self.MES_TEST_DB_HOST:
            return None
        return URL.create(
            "mssql+pyodbc",
            username=self.MES_TEST_DB_USERNAME,
            password=self.MES_TEST_DB_PASSWORD,
            host=self.MES_TEST_DB_HOST,
            port=self.MES_TEST_DB_PORT,
            database=self.MES_TEST_DB_DATABASE,
            query={
                "driver": self.DB_DRIVER,
                "Encrypt": "yes" if self.MES_TEST_DB_ENCRYPT else "no",
                "TrustServerCertificate": (
                    "yes" if self.MES_TEST_DB_TRUST_SERVER_CERTIFICATE else "no"
                ),
            },
        )

    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_emails_from(self) -> Self:
        if not self.EMAILS_FROM_NAME:
            self.EMAILS_FROM_NAME = self.PROJECT_NAME
        return self

    EMAIL_RESET_TOKEN_EXPIRE_HOURS: int = 48

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)

    EMAIL_TEST_USER: EmailStr = "test@example.com"
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("DB_PASSWORD", self.DB_PASSWORD)
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )

        return self


settings = Settings()  # type: ignore
