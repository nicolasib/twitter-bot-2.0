const Twitter = require('twitter')
require('dotenv').config()
const server = require('./server')
const CronJob = require('cron').CronJob
const cors = require('cors')

const pdfExtractor = require('pdf-table-extractor')

const fs = require('fs')
const url = require('url')
const http = require('http')

const cliente = new Twitter({
    consumer_key: 'dLveNcUQB5WatJb7JtiDvpIQg',
    consumer_secret: 'oIFBvH0jmt3DfJOnXYPwN3wXyTqsez7I6Q8NxQHChJDjJgktB5',
    access_token_key: '1173561848949592065-G2k3EqMgwfEeeP3nVDh3F0estM8tKq',
    access_token_secret: 'G7Q4SKibF9j6BIyjR19CEke7lp22ES6836K7SSIZhRf1m'
})

server.use(cors())

let contador = 3

/*
O OBJETO É UM VETOR DE OBJETOS
CADA POSIÇÃO DO VETOR INICIAL É UMA SEMANA
O CONTEÚDO DA SEMANA TA NA MATRIZ "TABLES" DE CADA SEMANA

POSIÇÕES DA MATRIZ E SEUS RESPECTIVOS CONTEÚDOS:
    LINHAS:
        0 - DIAS DA SEMANA
        1 - DIAS DO MES
        2 - ARROZ
        3 - FEIJÃO
        4 - PRATO PRINCIPAL
        5 - GUARNIÇÃO
        6 - SALADA 1
        7 - SALADA 2
        8 - SALADA 3
        9 - SALADA 4
        10 - OPÇÃO VEGETARIANA
        11 - SOBREMESA
    
    COLUNAS:
        0 - TITULO
        1 - SEGUNDA
        2 - TERÇA
        3 - QUARTA
        4 - QUINTA
        5 - SEXTA
        6 - SABADO
*/


const server_port = process.env.PORT || 3000

let date = Date(Date.now())
date = date.split(' ')

let dateObject = {
    weekDay: weekDay(date[0]),
    month: monthStringfy(date[1]),
    year: date[3],
    changeDay(){
        if(this.weekDay + 1 > 7){
            this.weekDay++
        }else{
            this.weekDay = 1
        }
    }
}

const job = new CronJob('00 15 08 * * 0-6', function(){
    
    fs.access(`./pdf/cardapio${dateObject.month}-${dateObject.year}.pdf`, (err) => {
        downloadNewPDF(dateObject.month, dateObject.year)
    })
    
    setTimeout(() => {
        ExtractAndTweet(dateObject.weekDay, dateObject.month, dateObject.year)
    }, 5000)
    
}, function(){
    console.log(`Cron stopped!`)
}, true, 'America/Sao_Paulo')

function weekDay(dayString){
    switch(dayString){
        case 'Mon':
            return '1'
        break
        case 'Tue':
            return '2'
        break
        case 'Wed':
            return '3'
        break
        case 'Thu':
            return '4'
        break
        case 'Fri':
            return '5'
        break
        case 'Sat': 
            return '6'
        break
        case 'Sun':
            return '7'
        break
    }
}

function monthStringfy(month){
    switch(month){
        case 'Jan':
            return '01'
        break
        case 'Feb':
            return '02'
        break
        case 'Mar':
            return '03'
        break
        case 'Apr':
            return '04'
        break
        case 'May':
            return '05'
        break
        case 'Jun':
            return '06'
        break
        case 'Jul':
            return '07'
        break
        case 'Aug':
            return '08'
        break
        case 'Sep':
            return '09'
        break
        case 'Oct':
            return '10'
        break
        case 'Nov':
            return '11'
        break
        case 'Dec':
            return '12'
        break
    }
}

async function downloadNewPDF(month, year){
    let file_url = `http://www.spe.cefetmg.br/wp-content/uploads/sites/85/2017/03/Card%C3%A1pio-Divi.${month}-${year}.pdf`
    const file = fs.createWriteStream(`./pdf/cardapio${month}-${year}.pdf`)

    const req = http.get(file_url, function(response){
        response.pipe(file)
    })

    console.log('downloaded!')
}

cliente.tweetar = function (tweet){
    console.log("tweet = " + tweet)
    cliente.post('statuses/update', { status: tweet }, function(error, tweet, response){
        if(error) console.log(error)
        else console.log('Tweet enviado!')
    })
}

function montaMensagem(obj){
    msg = `Feijão: ${obj.feijao}\nPrato principal: ${obj.pratoPrincipal}\n`
    msg += `Guarnição: ${obj.guarnicao}\nSalada 1: ${obj.saladaUm}\n`
    msg += `Salada 2: ${obj.saladaDois}\nOpção vegetariana: ${obj.vegetariana}\n`
    msg += `\nSobremesa: ${obj.sobremesa}\n\nBom apetite! =)`

    return msg
}


async function ExtractAndTweet(day, month, year){
    try{
        await pdfExtractor(`./pdf/cardapio${month}-${year}.pdf`, async data => {
            if(day === 7){
                verificaNovaSemana()
                cliente.tweetar('Aproveite seu domingo! =)')
            }else if(data.pageTables[contador].tables[3][day+1] === '' && day != 6){
                //Preparando para o proximo dia
                if(month+1 !== 12){
                    month++
                }else{
                    month = 01
                    year++
                } 
                await downloadNewPDF(month, year) //Baixa o novo PDF
                
                let dadosFinais = {
                    feijao: data.pageTables[contador].tables[3][day],
                    pratoPrincipal: data.pageTables[contador].tables[4][day],
                    guarnicao: data.pageTables[contador].tables[5][day],
                    saladaUm: data.pageTables[contador].tables[6][day],
                    saladaDois: data.pageTables[contador].tables[7][day],
                    vegetariana: data.pageTables[contador].tables[10][day],
                    sobremesa: data.pageTables[contador].tables[11][day]
                }
                if(dadosFinais.feijao !== 'Recesso Escolar' && dadosFinais.feijao !== 'Feriado' && dadosFinais.feijao !== 'Recesso escolar'){
                    cliente.tweetar(montaMensagem(dadosFinais))
                    dateObject.changeDay()
                }else{
                    if(dadosFinais.feijao === 'Recesso escolar' || dadosFinais.feijao === 'Recesso Escolar'){
                        cliente.tweetar('Você está de férias! Aproveite ;)')
                        dateObject.changeDay()
                    }else if(dadosFinais.feijao === 'Feriado' || dadosFinais.feijao === 'feriado'){
                        cliente.tweetar('Hoje é feriado ;D\nNão tem almoço =(')
                        dateObject.changeDay()
                    }
                }
            }else{
                let dadosFinais = {
                    feijao: data.pageTables[contador].tables[3][day],
                    pratoPrincipal: data.pageTables[contador].tables[4][day],
                    guarnicao: data.pageTables[contador].tables[5][day],
                    saladaUm: data.pageTables[contador].tables[6][day],
                    saladaDois: data.pageTables[contador].tables[7][day],
                    vegetariana: data.pageTables[contador].tables[10][day],
                    sobremesa: data.pageTables[contador].tables[11][day]
                }
                if(dadosFinais.feijao !== 'Recesso Escolar' && dadosFinais.feijao !== 'Feriado' && dadosFinais.feijao !== 'Recesso escolar'){
                    cliente.tweetar(montaMensagem(dadosFinais))
                    dateObject.changeDay()
                }else{
                    if(dadosFinais.feijao === 'Recesso escolar' || dadosFinais.feijao === 'Recesso Escolar'){
                        cliente.tweetar('Você está de férias! Aproveite ;)')
                        dateObject.changeDay()
                    }else if(dadosFinais.feijao === 'Feriado'){
                        cliente.tweetar('Hoje é feriado ;D\nNão tem almoço =(')
                        dateObject.changeDay()
                    }
                }
            }  
        })       
        
    }catch(error){
        console.log(error)
    }
}

function verificaNovaSemana(){
    if(cardapioObject.pageTables[contador+1]){
        contador++
    }else{
        dateObject.month++
        downloadNewPDF(month, year)
    }
}

server.listen(server_port, function(error){
    console.log('Listening on port %d', server_port)
})