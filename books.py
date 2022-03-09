
from json import dumps

books = {}
with open("books.tsv") as fd:
    for line in fd:
        book, perek, pasuk = line.rstrip().split('\t')
        pasuk = int(pasuk)
        perek = int(perek)
        if not book in books:
            books[book] = {}
        books[book][perek] = pasuk
print(dumps(books))

