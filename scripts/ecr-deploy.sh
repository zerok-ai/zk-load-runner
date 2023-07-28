
ECR_URI="301129966109.dkr.ecr.us-east-2.amazonaws.com"
ECR_Region="us-east-2"
ECR_Repo_Name="xk6-api"
ECR_Repo_Version="latest"
ECR_Repo_URI="$ECR_URI/$ECR_Repo_Name:$ECR_Repo_Version"

docker build -t $ECR_Repo_Name .

docker tag $ECR_Repo_Name $ECR_Repo_URI

aws ecr get-login-password \
	--region $ECR_Region | docker login \
	--username AWS \
	--password-stdin $ECR_URI

docker push $ECR_Repo_URI
