import statistics

FOLDER = "swimdata/"


def read_swim_data(filename):
    swimmer, age, distance, stroke = filename.removesuffix('.txt').split('-')
    with open(FOLDER + filename) as file:
        lines = file.readlines()
        times = lines[0].strip().split(',')

    converts = []
    for t in times:
        if ':' in t:
            minutes, rest = t.split(':')
        else:
            minutes = '0'
            rest = t
        seconds, hundredths = rest.split('.')
        converted_time = int(minutes) * 6000 + \
            int(seconds) * 100 + int(hundredths)
        # print(t, "->", converted_time)
        converts.append(converted_time)

    avg = statistics.mean(converts)
    minutes_seconds, hundredths = str(round(avg / 100, 2)).split('.')
    minutes = int(int(minutes_seconds) // 60)
    seconds = int(minutes_seconds) - minutes * 60
    average = str(minutes) + ':' + str(seconds).zfill(2) + '.' + hundredths

    return swimmer, age, distance, stroke, times, average
