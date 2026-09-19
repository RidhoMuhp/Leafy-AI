class DatabaseError(Exception):
    pass


class UnknownDatabaseError(DatabaseError):
    pass


class DatabaseAccessDeniedError(DatabaseError, PermissionError):
    pass


class DatabaseConfigurationError(DatabaseError):
    pass


class DatabaseConnectionError(DatabaseError):
    pass

class UnknownTableError(DatabaseError):
    pass


class TableAccessDeniedError(DatabaseError, PermissionError):
    pass