Mayer Distribution PWA - versiunea 1.2

Continut
- index.html: aplicatia Mayer Distribution
- manifest.json: numele aplicatiei si configuratia PWA
- sw.js: cache offline pentru fisierele aplicatiei
- icons/: iconite pentru Android, iOS si browser
- MayerDistribution.ico: iconita multi-dimensiune pentru o scurtatura Windows

Actualizare fara pierderea datelor
Daca folosesti deja aplicatia, fa mai intai un backup din Setari > Descarca backup. Pastreaza folderul existent ProgramTransport_PWA_v1 si extrage fisierele din aceasta arhiva peste el, in aceeasi locatie, pentru a pastra aceeasi cale catre index.html. Nu sterge datele browserului. Cheile localStorage pt_lists si pt_programs au ramas neschimbate.

Instalare pe telefon
Pentru instalarea ca aplicatie PWA pe Android/iOS, fisierele trebuie gazduite pe HTTPS. Deschide URL-ul in Chrome/Android sau Safari/iOS si foloseste optiunea browserului de adaugare/instalare pe ecranul principal. Numele afisat va fi Mayer Distribution, iar browserul va folosi iconitele incluse.

Scurtatura pe desktop Windows
- Pentru o scurtatura simpla catre fisierul HTML: click dreapta pe index.html > Show more options > Send to > Desktop (create shortcut).
- Pentru iconita Mayer Distribution: click dreapta pe scurtatura > Properties > Change Icon > Browse si selecteaza MayerDistribution.ico din folderul aplicatiei.
- Daca deschizi aplicatia din file://, unele functii PWA (instalare si service worker) nu sunt disponibile. Pentru testare foloseste pasii de mai jos.

Test local pe Windows
1. Extrage arhiva.
2. Deschide Command Prompt in folderul care contine index.html.
3. Ruleaza: py -m http.server 8080
4. Deschide http://localhost:8080/ in browser.

Important
- Deschiderea fisierului prin file:// nu permite instalarea PWA si nu activeaza service worker-ul.
- Datele aplicatiei raman locale in browser. Backup-ul JSON este manual si nu exista sincronizare automata intre dispozitive.
- Restaurarea unui backup inlocuieste nomenclatoarele si istoricul existente; fa un backup inainte de restaurare.
