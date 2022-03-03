FROM python:3.7-slim

ADD generator.py /tmp
ADD requirements.txt /tmp

RUN pip install -r /tmp/requirements.txt

CMD [ "python", "/tmp/generator.py" ]
