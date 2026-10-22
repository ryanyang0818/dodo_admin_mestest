from fastapi import APIRouter

from app.api.routes import (
    database_mes_dictionary,
    database_tt_dictionary,
    erp_menu_readonly,
    erp_slip_readonly,
    erp_wo_readonly,
    hello,
    items,
    login,
    menus,
    mes_user_report,
    mes_wo_report,
    mes_work_report,
    mes_inspection_query,
    private,
    system_menus,
    test,
    todo_report,
    todos,
    user_report,
    role_report,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(todos.router)
api_router.include_router(todo_report.router)
api_router.include_router(menus.router)
api_router.include_router(system_menus.router)
api_router.include_router(user_report.router)
api_router.include_router(role_report.router)
api_router.include_router(mes_user_report.router)
api_router.include_router(mes_wo_report.router)
api_router.include_router(mes_work_report.router)
api_router.include_router(mes_inspection_query.router)
api_router.include_router(database_mes_dictionary.router)
api_router.include_router(database_tt_dictionary.router)
api_router.include_router(erp_menu_readonly.router)
api_router.include_router(erp_slip_readonly.router)
api_router.include_router(erp_wo_readonly.router)
api_router.include_router(test.router)
api_router.include_router(hello.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
