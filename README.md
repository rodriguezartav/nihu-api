# lambda-cpx

1. Lambda based microservice.


Deploy Staging
1. aws cloudformation package     --template-file ./template.yml     --s3-bucket dev3sam     --output-template-file packaged-template.yaml

2. aws cloudformation deploy --template-file ./packaged-template.yaml --stack-name delete-stack --parameter-overrides FunctionNameSuffix=stage --capabilities CAPABILITY_IAM --region us-east-1# nihu-api
