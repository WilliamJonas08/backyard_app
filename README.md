# 🏃 Backyard Race

Application web légère pour suivre **en live** les statistiques d'une course
*backyard ultra* sur une journée : une boucle part chaque heure (jusqu'à 10),
chaque boucle fait 4 km ou 6,5 km. Après chaque boucle, un·e admin saisit le
temps du coureur et valide le tour ; le classement et les graphiques se mettent
à jour automatiquement.

Les participants accèdent à tout via un simple **QR code / URL**. Pensée
**mobile d'abord**, thème sombre & sportif.

---

## Pile technique

- **Backend** : [FastAPI](https://fastapi.tiangolo.com/) + **SQLite** (un simple
  fichier, aucune base à administrer).
- **Frontend** : HTML/CSS/JS *vanilla* servi par le même service — aucun build.
- **Live** : le front rafraîchit les résultats toutes les ~10 s (polling).

Un seul processus à déployer.

## Structure du projet

```
app/
  main.py          Point d'entrée FastAPI (API + sert le frontend)
  config.py        Configuration de l'événement + mots de passe (env)
  models.py        Entités du domaine + schémas d'API (Pydantic)
  storage.py       Accès SQLite — le SEUL module qui parle SQL
  services.py      Logique métier pure : classement, distances, vitesses
  auth.py          Contrôle d'accès admin / super-admin
  dependencies.py  Câblage des dépendances FastAPI
  routers/
    public.py      event, inscription, classement, séries pour les graphiques
    admin.py       saisie des résultats (admin) + corrections (super-admin)
frontend/
  index.html       App en onglets : Infos · Résultats · Admin
  css/style.css    Thème sombre & sportif, mobile-first
  js/api.js        Wrapper fetch
  js/charts.js     Graphique SVG minimaliste (points + gros point à initiales)
  js/app.js        État, navigation, polling, rendu
scripts/
  generate_qr.py   Génère le QR code vers l'URL de l'app
  seed_demo.py     Données de démo pour tester le rendu
tests/
  test_services.py Tests unitaires du classement et des métriques
```

## Démarrage local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# (optionnel) définir les mots de passe ; sinon "admin" / "superadmin" par défaut
export ADMIN_PASSWORD=monsecret
export SUPERADMIN_PASSWORD=monsupersecret

uvicorn app.main:app --reload
```

Ouvre http://localhost:8000. Pour tester sur ton téléphone, lance
`uvicorn app.main:app --host 0.0.0.0 --port 8000` et vise `http://<ip-locale>:8000`.

### Données de démonstration

```bash
python scripts/seed_demo.py
```

### Tests

```bash
pytest
```

## Configuration de l'événement

Tout ce qui décrit ta course (nom, sous-titre, nombre de boucles, types de
boucles et leurs distances, texte de présentation, checklist participant) se
trouve dans `DEFAULT_EVENT` au sein de [`app/config.py`](app/config.py). Édite
ces valeurs, c'est tout.

## Accès

- **Participant** : scanne le QR / ouvre l'URL → s'inscrit → suit le classement.
- **Admin** : onglet *Admin* → mot de passe `ADMIN_PASSWORD` → saisit les
  résultats.
- **Super-admin** : depuis l'espace admin → mot de passe `SUPERADMIN_PASSWORD`
  → corrige ou supprime des enregistrements.

## Déploiement

Voir [`PERSONAL_TODO.md`](PERSONAL_TODO.md) pour la marche à suivre complète
(hébergeur, disque persistant pour le `.db`, génération du QR code).
