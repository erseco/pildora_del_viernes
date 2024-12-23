.PHONY: install serve build clean

install:
	brew install hugo

serve:
	hugo server -D --disableFastRender

build:
	hugo

clean:
	rm -rf public/
