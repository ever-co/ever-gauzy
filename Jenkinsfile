pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKER_BUILDKIT = 1 // Experimental faster build system
        IMAGE_API = "gauzy/api"
        IMAGE_WEBAPP = "gauzy/webapp"
        GITHUB_DOCKER_USERNAME = credentials('github-docker-username')
        GITHUB_DOCKER_PASSWORD = credentials('github-docker-password')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
        AWS_DEFAULT_REGION = "us-east-1"
        AWS_ECR = """${sh(
                  returnStdout: true,
                  script: "\$(echo \$(aws ecr get-login --no-include-email | grep -o 'https://.*' | sed 's|https://||g'))"
                  )}
                  """
    }

    stages {
        stage("Clone") {
            steps{
                git branch: 'develop',
                    url: 'https://github.com/ever-co/gauzy.git'
            }
            post {
                success {
                    echo "Cloning successful..."
                }
                failure {
                    echo "Cloning failed! See log for details. Terminating..."
                }
            }
        }
        stage("Docker Image Build") {
            parallel {
                stage("API Image") {
                    steps {
                        sh "docker build -t ${env.IMAGE_API} -f .deploy/api/Dockerfile ."
                    }
                    post{
                        success {
                            echo "Image for API built!"
                        }
                        failure {
                            echo "API Image build failed..."
                        }
                    }
                }
                stage("Gauzy WebApp Image") {
                    steps {
                        sh "docker build -t ${env.IMAGE_WEBAPP} -f .deploy/webapp/Dockerfile ."
                    }
                    post {
                        success {
                            echo "Image for Webapp built!"
                        }
                        failure {
                            echo "Webapp image build failed..."
                        }
                    }
                }
            }
        }
        stage("Login to repositories") {
            steps {
                sh "docker login docker.pkg.github.com -u ${env.GITHUB_DOCKER_USERNAME} -p ${env.GITHUB_DOCKER_PASSWORD}"
                script {
                    sh("eval \$(aws ecr get-login --no-include-email | sed 's|https://||')")
                } // Login to AWS ECR
            }
        }
        stage ("Push API Image") {
            parallel {
                stage ("Push to AWS ECR") {
                    steps {
                        // Tag and push to ECR
                        sh "docker tag ${env.IMAGE_API} ${env.AWS_ECR}/${env.IMAGE_API}"
                        sh "docker push ${env.AWS_ECR}/${env.IMAGE_API}"
                        sh "docker rmi ${env.AWS_ECR}/${env.IMAGE_API}" // Cleans tag
                    }
                    post {
                        success {
                            echo "Successfuly pushed to ECR on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to ECR failed! See log for details..."
                        }
                    }
                }
                stage ("Push to GitHub") {
                    steps {
                        sh "docker tag ${env.IMAGE_API} docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}"
                        sh "docker rmi docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}" // Cleans Tag
                    }
                    post {
                        success {
                            echo "Successfully pushed to GitHub on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to GitHub failed! See log for details..."
                        }
                    }
                }
            }
        }
        stage ("Push WebApp Image") {
            parallel {
                stage ("Push to AWS ECR") {
                    steps {
                        sh "docker tag ${env.IMAGE_WEBAPP} ${env.AWS_ECR}/${env.IMAGE_WEBAPP}"
                        sh "docker push ${env.AWS_ECR}/${env.IMAGE_WEBAPP}"
                        sh "docker rmi ${env.AWS_ECR}/${env.IMAGE_WEBAPP}"
                    }
                    post {
                        success {
                            echo "Successfully pushed to ECR on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to ECR failed! See log for details..."
                        }
                    }
                }
                stage ("Push to GitHub") {
                    steps {
                        sh "docker tag docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}"
                        sh "docker rmi docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}"
                    }
                    post {
                        success {
                            echo "Successfully pushed to GitHub on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to GitHub failed! See log for details..."
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            echo "Gauzy CI/CD pipeline executed successfully!"
        }
        failure {
            echo "Gauzy CI/CD pipeline failed..."
        }
    }
}