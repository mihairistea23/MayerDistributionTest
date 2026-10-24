# Plan de integrare Firebase - MayerDistribution

Status: planificare; aplicatia v1.5 ramane nemodificata.

## Scop

Pregatirea sincronizarii intre dispozitive cu Firebase Authentication si Cloud Firestore, pornind de la aplicatia existenta care foloseste localStorage. Aceasta documentatie nu activeaza sincronizarea si nu schimba comportamentul aplicatiei.

## Situatia actuala

- Versiunea curenta a aplicatiei este v1.5.
- Datele sunt stocate local in browser in cheile localStorage `pt_lists` si `pt_programs`.
- Backup-ul JSON contine nomenclatoarele si istoricul programelor; importul inlocuieste datele existente pe dispozitiv.
- Prototipul separat MayerDistributionPrototip a demonstrat login Firebase si sincronizare Firestore in timp real pentru operatii CRUD.
- Datele operationale reale nu trebuie folosite in prototip si nu trebuie incarcate in repository.

## Reguli de lucru

1. Nu se modifica ramurile `main` sau `backup/v1.5` in cadrul acestei etape.
2. Orice implementare se face exclusiv pe `feature/firebase-sync`.
3. Nu se publica in productie si nu se face merge in `main` fara validarea explicita a proprietarului aplicatiei.
4. Backup-ul JSON ramane disponibil ca mecanism independent de recuperare.
5. Nu se includ parole, token-uri private, service-account keys sau fisiere JSON cu date operationale in GitHub.
6. Firebase Web config poate fi inclus in client doar dupa verificarea regulilor Firestore si a configuratiei de securitate; cheia de configurare nu inlocuieste regulile de acces.

## Etape propuse

### 1. Analiza si criterii de acceptare
- Inventarierea tuturor operatiilor care citesc sau modifica `pt_lists` si `pt_programs`.
- Stabilirea modelului Firestore si a identificatorilor stabili pentru fiecare inregistrare.
- Definirea comportamentului pentru stergeri, editari concurente, utilizatori si dispozitive multiple.

### 2. Securitate
- Validarea autentificarii si a regulilor Firestore cu utilizatori autorizati si neautorizati.
- Stabilirea delimitarii datelor pe utilizator sau organizatie.
- Verificarea ca accesul neautorizat la citire, creare, editare si stergere este respins.
- Nu se considera aplicatia sigura doar pentru ca pagina este gazduita pe GitHub Pages.

### 3. Migrare controlata
- Definirea unei actiuni explicite de import initial a datelor locale in cloud.
- Verificari inainte si dupa import pentru numarul si continutul inregistrarilor.
- Evitarea importurilor duplicate la repetarea procesului.
- Nu se sterg datele locale dupa import inainte de validare si backup.

### 4. Sincronizare si recuperare
- Implementarea sincronizarii bidirectionale numai dupa validarea modelului si regulilor.
- Gestionarea pierderii conexiunii si a reconectarii.
- Tratarea conflictelor si a stergerilor pe mai multe dispozitive.
- Pastrarea exportului si restaurarii backup-ului JSON.

### 5. Testare
- Teste cu date fictive pe PC si Android.
- Teste de adaugare, editare, stergere, doua modificari concurente, offline/online si reconectare.
- Teste pentru permisiuni si acces intre conturi.
- Validarea regresiei tuturor fluxurilor existente din v1.5.

### 6. Lansare
- Revizuirea modificarilor din `feature/firebase-sync`.
- Backup nou al codului si al datelor de test.
- Publicare de test separata, daca este necesara.
- Merge si publicare in productie numai dupa aprobarea explicita.

## Criterii minime inainte de lansare

- Nicio pierdere sau duplicare de date in scenariile testate.
- Accesul neautorizat este respins de regulile Firestore.
- Sincronizarea functioneaza dupa reconectare.
- Conflictele au un comportament definit si testat.
- Backup-ul JSON poate fi exportat si restaurat.
- Fluxurile existente din v1.5 trec testele de regresie.

## Stare curenta

Acest commit adauga numai documentatia planului. Nu adauga SDK Firebase in aplicatia principala, nu modifica datele browserului si nu publica versiunea v1.5.
