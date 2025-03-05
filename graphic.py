import matplotlib.pyplot as plt
from datetime import datetime

# Örnek commit tarihleri
commit_dates = [
    "2023-10-01", "2023-10-01", "2023-10-02", "2023-10-03",
    "2023-10-03", "2023-10-04", "2023-10-05", "2023-10-05",
    "2023-10-06", "2023-10-06", "2023-10-06", "2023-10-07"
]

# Tarihleri datetime formatına çevir
commit_dates = [datetime.strptime(date, "%Y-%m-%d") for date in commit_dates]

# Her bir tarihteki commit sayısını hesapla
date_counts = {date: commit_dates.count(date) for date in set(commit_dates)}

# Grafiği çiz
plt.figure(figsize=(10, 5))
plt.bar(date_counts.keys(), date_counts.values(), color='skyblue')
plt.xlabel('Tarih')
plt.ylabel('Commit Sayısı')
plt.title('Günlük Commit Sayısı')
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()