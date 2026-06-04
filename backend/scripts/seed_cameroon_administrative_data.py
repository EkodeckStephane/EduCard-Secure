from pathlib import Path
import sys
from unicodedata import normalize

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import Department, Region, Subdivision


CAMEROON_ADMIN_DATA = [
    {
        "code": "ADAMAOUA",
        "name": "Adamaoua",
        "capital": "Ngaoundere",
        "departments": [
            ("DJEREM", "Djerem", "Tibati", ["Ngaoundal", "Tibati"]),
            ("FARO-ET-DEO", "Faro-et-Deo", "Tignere", ["Galim-Tignere", "Kontcha", "Mayo-Baleo", "Tignere"]),
            ("MAYO-BANYO", "Mayo-Banyo", "Banyo", ["Bankim", "Banyo", "Mayo-Darle"]),
            ("MBERE", "Mbere", "Meiganga", ["Dir", "Djohong", "Meiganga", "Ngaoui"]),
            ("VINA", "Vina", "Ngaoundere", ["Belel", "Martap", "Mbe", "Ngan-Ha", "Ngaoundere 1er", "Ngaoundere 2e", "Ngaoundere 3e", "Nyambaka"]),
        ],
    },
    {
        "code": "CENTRE",
        "name": "Centre",
        "capital": "Yaounde",
        "departments": [
            ("HAUTE-SANAGA", "Haute-Sanaga", "Nanga-Eboko", ["Bibey", "Lembe-Yezoum", "Mbandjock", "Minta", "Nanga-Eboko", "Nkoteng", "Nsem"]),
            ("LEKIE", "Lekie", "Monatele", ["Batschenga", "Ebebda", "Elig-Mfomo", "Evodoula", "Lobo", "Monatele", "Obala", "Okola", "Sa'a"]),
            ("MBAM-ET-INOUBOU", "Mbam-et-Inoubou", "Bafia", ["Bafia", "Bokito", "Deuk", "Kiiki", "Kon-Yambetta", "Makenene", "Ndikinimeki", "Nitoukou", "Ombessa"]),
            ("MBAM-ET-KIM", "Mbam-et-Kim", "Ntui", ["Mbangassina", "Ngambe-Tikar", "Ngoro", "Ntui", "Yoko"]),
            ("MEFOU-ET-AFAMBA", "Mefou-et-Afamba", "Mfou", ["Afanloum", "Awae", "Edzendouan", "Esse", "Mfou", "Nkolafamba", "Olanguina", "Soa"]),
            ("MEFOU-ET-AKONO", "Mefou-et-Akono", "Ngoumou", ["Akono", "Bikok", "Mbankomo", "Ngoumou"]),
            ("MFOUNDI", "Mfoundi", "Yaounde", ["Yaounde 1er", "Yaounde 2e", "Yaounde 3e", "Yaounde 4e", "Yaounde 5e", "Yaounde 6e", "Yaounde 7e"]),
            ("NYONG-ET-KELLE", "Nyong-et-Kelle", "Eseka", ["Biyouha", "Bondjock", "Bot-Makak", "Dibang", "Eseka", "Makak", "Matomb", "Messondo", "Ngog-Mapubi", "Nguibassal"]),
            ("NYONG-ET-MFOUMOU", "Nyong-et-Mfoumou", "Akonolinga", ["Akonolinga", "Ayos", "Endom", "Kobdombo", "Mengang"]),
            ("NYONG-ET-SO'O", "Nyong-et-So'o", "Mbalmayo", ["Akoeman", "Dzeng", "Mbalmayo", "MengueMe", "Ngomedzap", "Nkolmetet"]),
        ],
    },
    {
        "code": "EST",
        "name": "Est",
        "capital": "Bertoua",
        "departments": [
            ("BOUMBA-ET-NGOKO", "Boumba-et-Ngoko", "Yokadouma", ["Gari-Gombo", "Moloundou", "Salapoumbe", "Yokadouma"]),
            ("HAUT-NYONG", "Haut-Nyong", "Abong-Mbang", ["Abong-Mbang", "Angossas", "Atok", "Dimako", "Doumaintang", "Doume", "Dja", "Lomie", "Mboma", "Messamena", "Messok", "Ngoyla", "Nguelemendouka", "Somalomo"]),
            ("KADEY", "Kadey", "Batouri", ["Batouri", "Kette", "Mbang", "Mbotoro", "Ndelele", "Nguelebok", "Ouli"]),
            ("LOM-ET-DJEREM", "Lom-et-Djerem", "Bertoua", ["Belabo", "Bertoua 1er", "Bertoua 2e", "Betare-Oya", "Diang", "Garoua-Boulai", "Mandjou", "Ngoura"]),
        ],
    },
    {
        "code": "EXTREME-NORD",
        "name": "Extreme-Nord",
        "capital": "Maroua",
        "departments": [
            ("DIAMARE", "Diamare", "Maroua", ["Bogo", "Dargala", "Gazawa", "Maroua 1er", "Maroua 2e", "Maroua 3e", "Meri", "Ndoukoula", "Pette"]),
            ("LOGONE-ET-CHARI", "Logone-et-Chari", "Kousseri", ["Blangoua", "Darak", "Fotokol", "Goulfey", "Hile-Halifa", "Kousseri", "Logone-Birni", "Makary", "Waza", "Zina"]),
            ("MAYO-DANAY", "Mayo-Danay", "Yagoua", ["Datcheka", "Gobo", "Guere", "Kai-Kai", "Kalfou", "Kar-Hay", "Maga", "Tchatibali", "Vele", "Wina", "Yagoua"]),
            ("MAYO-KANI", "Mayo-Kani", "Kaele", ["Guidiguis", "Kaele", "Mindif", "Moulvoudaye", "Moutourwa", "Porhi", "Taibong"]),
            ("MAYO-SAVA", "Mayo-Sava", "Mora", ["Kolofata", "Mora", "Tokombere"]),
            ("MAYO-TSANAGA", "Mayo-Tsanaga", "Mokolo", ["Bourrha", "Hina", "Koza", "Mogode", "Mokolo", "Mayo-Moskota", "Soulede-Roua"]),
        ],
    },
    {
        "code": "LITTORAL",
        "name": "Littoral",
        "capital": "Douala",
        "departments": [
            ("MOUNGO", "Moungo", "Nkongsamba", ["Bare-Bakem", "Dibombari", "Fiko", "Loum", "Manjo", "Mbanga", "Melong", "Njombe-Penja", "Nkongsamba 1er", "Nkongsamba 2e", "Nkongsamba 3e", "Nlonako", "Mombo"]),
            ("NKAM", "Nkam", "Yabassi", ["Nkondjock", "Nord-Makombe", "Yabassi", "Yingui"]),
            ("SANAGA-MARITIME", "Sanaga-Maritime", "Edea", ["Dibamba", "Dizangue", "Edea 1er", "Edea 2e", "Massock-Songloulou", "Mouanko", "Ndom", "Ngambe", "Ngwei", "Nyanon", "Pouma"]),
            ("WOURI", "Wouri", "Douala", ["Douala 1er", "Douala 2e", "Douala 3e", "Douala 4e", "Douala 5e", "Douala 6e"]),
        ],
    },
    {
        "code": "NORD",
        "name": "Nord",
        "capital": "Garoua",
        "departments": [
            ("BENOUE", "Benoue", "Garoua", ["Bascheo", "Bibemi", "Dembo", "Demsa", "Garoua 1er", "Garoua 2e", "Garoua 3e", "Lagdo", "Mayo-Hourna", "Ngong", "Pitoa", "Touroua"]),
            ("FARO", "Faro", "Poli", ["Beka", "Poli"]),
            ("MAYO-LOUTI", "Mayo-Louti", "Guider", ["Figuil", "Guider", "Mayo-Oulo"]),
            ("MAYO-REY", "Mayo-Rey", "Tchollire", ["Madingring", "Rey-Bouba", "Tchollire", "Touboro"]),
        ],
    },
    {
        "code": "NORD-OUEST",
        "name": "Nord-Ouest",
        "capital": "Bamenda",
        "departments": [
            ("BUI", "Bui", "Kumbo", ["Jakiri", "Kumbo", "Mbven", "Nkum", "Noni", "Oku"]),
            ("BOYO", "Boyo", "Fundong", ["Belo", "Bum", "Fundong", "Njinikom"]),
            ("DONGA-MANTUNG", "Donga-Mantung", "Nkambe", ["Ako", "Misaje", "Ndu", "Nkambe", "Nwa"]),
            ("MENCHUM", "Menchum", "Wum", ["Fungom", "Furu-Awa", "Menchum Valley", "Wum"]),
            ("MEZAM", "Mezam", "Bamenda", ["Bafut", "Bali", "Bamenda 1er", "Bamenda 2e", "Bamenda 3e", "Santa", "Tubah"]),
            ("MOMO", "Momo", "Mbengwi", ["Batibo", "Mbengwi", "Njikwa", "Ngie", "Widikum-Menka"]),
            ("NGO-KETUNJIA", "Ngo-Ketunjia", "Ndop", ["Babessi", "Balikumbat", "Ndop"]),
        ],
    },
    {
        "code": "OUEST",
        "name": "Ouest",
        "capital": "Bafoussam",
        "departments": [
            ("BAMBOUTOS", "Bamboutos", "Mbouda", ["Babadjou", "Batcham", "Galim", "Mbouda"]),
            ("HAUT-NKAM", "Haut-Nkam", "Bafang", ["Bafang", "Bakou", "Bana", "Bandja", "Banka", "Banwa", "Kekem"]),
            ("HAUTS-PLATEAUX", "Hauts-Plateaux", "Baham", ["Baham", "Bamendjou", "Bangou", "Batie"]),
            ("KOUNG-KHI", "Koung-Khi", "Bandjoun", ["Bayangam", "Djebem", "Pete-Bandjoun"]),
            ("MENOUA", "Menoua", "Dschang", ["Dschang", "Fokoue", "Fongo-Tongo", "Nkong-Ni", "Penka-Michel", "Santchou"]),
            ("MIFI", "Mifi", "Bafoussam", ["Bafoussam 1er", "Bafoussam 2e", "Bafoussam 3e"]),
            ("NDE", "Nde", "Bangangte", ["Bangangte", "Bassamba", "Bazou", "Tonga"]),
            ("NOUN", "Noun", "Foumban", ["Bangourain", "Foumban", "Foumbot", "Kouoptamo", "Koutaba", "Magba", "Malantouen", "Massangam", "Njimom"]),
        ],
    },
    {
        "code": "SUD",
        "name": "Sud",
        "capital": "Ebolowa",
        "departments": [
            ("DJA-ET-LOBO", "Dja-et-Lobo", "Sangmelima", ["Bengbis", "Djoum", "Meyomessala", "Meyomessi", "Mintom", "Oveng", "Sangmelima", "Zoetele"]),
            ("MVILA", "Mvila", "Ebolowa", ["Biwong-Bane", "Biwong-Bulu", "Ebolowa 1er", "Ebolowa 2e", "Efoulan", "Mengong", "Mvangane", "Ngoulemakong"]),
            ("OCEAN", "Ocean", "Kribi", ["Akom II", "Bipindi", "Campo", "Kribi 1er", "Kribi 2e", "Lokoundje", "Lolodorf", "Mvengue", "Niete"]),
            ("VALLEE-DU-NTEM", "Vallee-du-Ntem", "Ambam", ["Ambam", "Kye-Ossi", "Ma'an", "Olamze"]),
        ],
    },
    {
        "code": "SUD-OUEST",
        "name": "Sud-Ouest",
        "capital": "Buea",
        "departments": [
            ("FAKO", "Fako", "Limbe", ["Buea", "Limbe 1er", "Limbe 2e", "Limbe 3e", "Muyuka", "Tiko", "West-Coast"]),
            ("KUPE-MANENGUBA", "Kupe-Manenguba", "Bangem", ["Bangem", "Nguti", "Tombel"]),
            ("LEBIALEM", "Lebialem", "Menji", ["Alou", "Fontem", "Wabane"]),
            ("MANYU", "Manyu", "Mamfe", ["Akwaya", "Eyumodjock", "Mamfe", "Upper-Bayang"]),
            ("MEME", "Meme", "Kumba", ["Bonge", "Konye", "Kumba 1er", "Kumba 2e", "Kumba 3e"]),
            ("NDIAN", "Ndian", "Mundemba", ["Bamusso", "Dikome-Balue", "Ekondo-Titi", "Idabato", "Isanguele", "Kombo-Abedimo", "Kombo-Idinti", "Mundemba", "Toko"]),
        ],
    },
]


def slug(value: str) -> str:
    normalized = normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return "-".join(normalized.upper().replace("'", "").replace("&", "ET").split())


def get_or_create(session, model, defaults=None, **criteria):
    row = session.execute(select(model).filter_by(**criteria)).scalar_one_or_none()
    if row:
        for key, value in (defaults or {}).items():
            setattr(row, key, value)
        return row
    row = model(**criteria, **(defaults or {}))
    session.add(row)
    session.flush()
    return row


def main() -> None:
    with SessionLocal() as session:
        region_count = 0
        department_count = 0
        subdivision_count = 0
        for region_data in CAMEROON_ADMIN_DATA:
            region = get_or_create(
                session,
                Region,
                code=region_data["code"],
                defaults={"name": region_data["name"], "capital": region_data["capital"], "is_demo": False},
            )
            region_count += 1
            for department_code, department_name, department_capital, subdivisions in region_data["departments"]:
                department = get_or_create(
                    session,
                    Department,
                    region_id=region.id,
                    code=department_code,
                    defaults={"name": department_name, "capital": department_capital, "is_demo": False},
                )
                department_count += 1
                for subdivision_name in subdivisions:
                    get_or_create(
                        session,
                        Subdivision,
                        department_id=department.id,
                        code=slug(subdivision_name),
                        defaults={"name": subdivision_name, "capital": subdivision_name, "is_demo": False},
                    )
                    subdivision_count += 1
        session.commit()
        print(f"Cameroon administrative data loaded: {region_count} regions, {department_count} departments, {subdivision_count} subdivisions.")


if __name__ == "__main__":
    main()
