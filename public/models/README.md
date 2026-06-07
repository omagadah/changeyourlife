# Modèles 3D (satellites, etc.)

Dépose ici les fichiers 3D à intégrer dans la scène spatiale de l'accueil.

## Comment me donner accès aux fichiers .obj / .mtl / .png
Tu ne peux pas me les "envoyer" dans le chat, mais tu peux les **déposer dans ce
dossier** : ils partent sur GitHub au prochain push et je les charge ensuite.

1. Copie tes fichiers dans `public/models/` (depuis l'explorateur Windows).
2. Garde les 3 fichiers ensemble et **renomme-les** simplement, par exemple :
   - `satellite-aim.obj`
   - `satellite-aim.mtl`
   - `satellite-aim.png`  (la texture référencée par le .mtl)
3. Important : le fichier `.mtl` doit référencer la texture par son nom exact
   (`map_Kd satellite-aim.png`). Si besoin je corrige le `.mtl` après dépôt.
4. Commit + push (VS Code → Source Control, ou dis-moi et je le fais).

Une fois les fichiers ici, je branche le chargeur (OBJLoader/MTLLoader) pour
remplacer le satellite « complexe » procédural par ton modèle NASA, et j'ajoute
les modèles poly.pizza pour les petits satellites.

## En attendant
6 satellites **procéduraux** (1 plus gros + 5 petits) tournent déjà autour de
l'arbre, + des **étoiles filantes** occasionnelles. Ils seront remplacés/complétés
par tes modèles dès qu'ils sont dans ce dossier.
