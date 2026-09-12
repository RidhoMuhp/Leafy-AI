INSERT INTO clients (
    client_code,
    name,
    business_type,
    phone,
    email,
    city,
    source,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    'TEST-CLIENT-001',
    'Demo Rental Makassar',
    'rental_car',
    NULL,
    'rental@example.invalid',
    'Makassar',
    'local_seed',
    'lead',
    'Data pengujian lokal, bukan klien asli',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM clients
    WHERE client_code = 'TEST-CLIENT-001'
);


INSERT INTO clients (
    client_code,
    name,
    business_type,
    phone,
    email,
    city,
    source,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    'TEST-CLIENT-002',
    'Demo Wedding Organizer',
    'wedding_organizer',
    NULL,
    'wedding@example.invalid',
    'Gowa',
    'local_seed',
    'contacted',
    'Data pengujian lokal, bukan klien asli',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM clients
    WHERE client_code = 'TEST-CLIENT-002'
);


INSERT INTO clients (
    client_code,
    name,
    business_type,
    phone,
    email,
    city,
    source,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    'TEST-CLIENT-003',
    'Demo Furniture Selayar',
    'furniture',
    NULL,
    'furniture@example.invalid',
    'Selayar',
    'local_seed',
    'follow_up',
    'Data pengujian lokal, bukan klien asli',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM clients
    WHERE client_code = 'TEST-CLIENT-003'
);