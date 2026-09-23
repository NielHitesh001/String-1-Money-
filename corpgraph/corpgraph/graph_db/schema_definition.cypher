CREATE CONSTRAINT company_entity_id_unique IF NOT EXISTS
FOR (company:Company) REQUIRE company.entity_id IS UNIQUE;

CREATE INDEX company_registration_number IF NOT EXISTS
FOR (company:Company) ON (company.registration_number);

CREATE INDEX company_jurisdiction IF NOT EXISTS
FOR (company:Company) ON (company.jurisdiction);

CREATE FULLTEXT INDEX company_name_search IF NOT EXISTS
FOR (company:Company) ON EACH [company.legal_name];

CREATE FULLTEXT INDEX company_search_v2 IF NOT EXISTS
FOR (company:Company) ON EACH
[company.legal_name, company.aliases, company.registration_number];

CREATE CONSTRAINT person_entity_id_unique IF NOT EXISTS
FOR (person:Person) REQUIRE person.entity_id IS UNIQUE;

CREATE INDEX person_full_name IF NOT EXISTS
FOR (person:Person) ON (person.full_name);
